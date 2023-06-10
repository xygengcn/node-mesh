import { Inject, Middleware } from '@/decorator';
import { INotifictionMessage, Message, MessageSource, isNotificationMessage } from '@/lib/message';
import type Server from '@/lib/server';
import type Client from '@/lib/client';
import { MiddlewareClass, MiddlewareParamKey, Next } from '../lib/middleware/index';
import { Transport } from '@/lib/transport';

/**
 * 普通通知消息
 */

@Middleware()
export default class NotificationMiddleware implements MiddlewareClass {
    /**
     *
     * @param message
     * @returns
     */
    public match(message: Message): boolean {
        return isNotificationMessage(message);
    }
    /**
     * 绑定
     * @returns
     */
    public bind(@Inject(MiddlewareParamKey.server) server: Server, @Inject(MiddlewareParamKey.client) client: Client, @Inject(MiddlewareParamKey.transport) transport: Transport) {
        return (message: Message<INotifictionMessage>, next: Next) => {
            if (client) {
                client.$debug('notification', message.id, message.action);
                client.$emit('notification', message);
            } else {
                // 回调
                server.$debug('notification', message.id, message.action);
                server.$emit('notification', message);
                // 广播到其他客户端 系统通知消息不广播
                if (message.source === MessageSource.custom) {
                    server.connectionManager.broadcast(message, (connection) => {
                        return connection.id !== transport.sender.socket.remoteId();
                    });
                }
            }
            next();
        };
    }
}
