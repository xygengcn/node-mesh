import { Inject, Middleware } from '@/decorator';
import CustomError, { CustomErrorCode } from '@/error';
import { Message, MessageSysAction, isRequestMessage, isSysMessage } from '@/lib/message';
import type Server from '@/lib/server';
import { type Transport } from '@/lib/transport';
import { MiddlewareClass, MiddlewareParamKey } from '../lib/middleware/index';

/**
 * 系统自带校验中间件
 */
@Middleware()
export default class AuthMiddleware implements MiddlewareClass {
    /**
     *
     * @param message
     * @returns
     */
    public match(message: Message): boolean {
        return isSysMessage(message) && isRequestMessage(message) && message.action === MessageSysAction.bindAuth;
    }
    /**
     * 绑定
     *
     * 1、现校验字段
     *
     * @returns
     */
    public bind(@Inject(MiddlewareParamKey.server) server: Server, @Inject(MiddlewareParamKey.transport) transport: Transport) {
        return (message: Message) => {
            const remoteId = transport.sender.socket.remoteId();

            server.$debug('[client-bind]', remoteId, message.params);

            // 客户端校验
            const [namespace, clientAuth, clientResponder, clientSubscriber] = message.params;

            // 服务端校验
            const serverAuth = server.options?.auth;

            // 服务端有权限校验且校验通过，
            if ((serverAuth && serverAuth === clientAuth) || !serverAuth) {
                server.connectionManager.bindName(namespace, remoteId);
                transport.sender.socket.$emit('online');
                // 请求
                if (Array.isArray(clientResponder)) {
                    clientResponder?.forEach((key) => {
                        server.responder.createHandler(key, remoteId);
                    });
                }

                // 订阅
                if (Array.isArray(clientSubscriber)) {
                    clientSubscriber?.forEach((key) => {
                        // 客户端绑定
                        transport.subscriber.sub(key);
                        // 绑定客户客户端
                        server.connectionManager.bindSubscribe(key, remoteId);
                    });
                }
                transport.callback(message, null, null);
            } else {
                server.$debug('[client-bindError]', remoteId);
                transport.callback(message, null, new CustomError(CustomErrorCode.bindError, '校验失败'));
            }
        };
    }
}
