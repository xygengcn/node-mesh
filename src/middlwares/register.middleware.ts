import { Inject, Middleware } from '@/decorator';
import { IMessage, Message, MessageSysAction, isNotificationMessage, isSysMessage } from '@/lib/message';
import type Server from '@/lib/server';
import { Transport } from '@/lib/transport';
import { MiddlewareClass, MiddlewareParamKey, Next } from '../lib/middleware/index';

/**
 * 客户端上线
 */

@Middleware()
export default class RegisterMiddleware implements MiddlewareClass {
    /**
     *
     * @param message
     * @returns
     */
    public match(message: Message): boolean {
        return isSysMessage(message) && isNotificationMessage(message) && message.action === MessageSysAction.register;
    }
    /**
     * 绑定
     * @returns
     */
    public bind(@Inject(MiddlewareParamKey.server) server: Server, @Inject(MiddlewareParamKey.transport) transport: Transport) {
        return (message: Message<IMessage<[Array<string>, Array<string>]>>, next: Next) => {
            const remoteId = transport.sender?.socket.remoteId();

            // 获取
            const [clientResponder, clientSubscriber]: [Array<string>, Array<string>] = message.params;

            server.$debug('[register]', remoteId, clientResponder, clientSubscriber);

            // 请求
            if (Array.isArray(clientResponder)) {
                clientResponder.forEach((key) => {
                    server.responder.createHandler(key, remoteId);
                });
            }

            // 订阅
            if (Array.isArray(clientSubscriber)) {
                clientSubscriber.forEach((key) => {
                    // 客户端绑定
                    transport.subscriber.sub(key);
                    // 绑定客户客户端
                    server.connectionManager.bindSubscribe(key, remoteId);
                });
            }
            next();
        };
    }
}
