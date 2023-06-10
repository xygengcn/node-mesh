import { Inject, Middleware } from '@/decorator';
import type Client from '@/lib/client';
import { Message, isPushMessage } from '@/lib/message';
import type Server from '@/lib/server';
import { MiddlewareClass, MiddlewareParamKey } from '../lib/middleware/index';
import { Transport } from '..';

/**
 * 订阅
 */
@Middleware()
export default class SubscribeMiddleware implements MiddlewareClass {
    /**
     *
     * @param message
     * @returns
     */
    public match(message: Message): boolean {
        return isPushMessage(message);
    }
    /**
     * 绑定
     *
     * 1、现校验字段
     *
     * @returns
     */
    public bind(
        @Inject(MiddlewareParamKey.server) server: Server,
        @Inject(MiddlewareParamKey.client) client: Client,
        @Inject(MiddlewareParamKey.transport) transport: Transport
    ) {
        return async (message: Message) => {
            const id = transport.sender.socket.remoteId();
            if (client) {
                client.$emit('subscribe', message.action, ...(message.params || []));
                client.transport.subscriber.pub(message.action, ...(message.params || []));
            } else {
                // 通知自己的事件
                if (server.subscriber.hasSub(message.action)) {
                    server.$emit('subscribe', message.action, ...(message.params || []));
                    server.subscriber.pub(message.action, ...(message.params || []));
                }
                // 通知订阅的客户端
                const connectionIds = server.connectionManager.findConnectionIdsBySubscribe(message.action);
                connectionIds.delete(id);
                const pushMessage = Message.createPublishMessage(message.action, ...(message.params || []));
                server.connectionManager.broadcast(pushMessage, connectionIds.toArray());
            }
        };
    }
}
