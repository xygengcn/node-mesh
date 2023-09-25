import { Inject, Middleware } from '@/decorator';
import { IMessage, Message, MessageSysAction, isNotificationMessage, isSysMessage } from '@/lib/message';
import type Server from '@/lib/server';
import { Transport } from '@/lib/transport';
import { MiddlewareClass, MiddlewareParamKey, Next } from '../lib/middleware/index';

/**
 * 客户端上线
 *
 * 服务端中间件
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
            const [responderEvents, subscribeEvents]: [Array<string>, Array<string>] = message.params;

            server.$debug('[register]', remoteId, responderEvents, subscribeEvents);

            // 绑定事件
            server.bindConnectionEvents(remoteId, responderEvents, subscribeEvents);
            next();
        };
    }
}
