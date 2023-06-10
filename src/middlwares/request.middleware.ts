import { Inject, Middleware } from '@/decorator';
import { Message, isRequestMessage } from '@/lib/message';
import type Server from '@/lib/server';
import { type Transport } from '@/lib/transport';
import type Client from '@/lib/client';
import { MiddlewareClass, MiddlewareParamKey } from '../lib/middleware/index';

/**
 * 请求回调
 */
@Middleware()
export default class RequestMiddleware implements MiddlewareClass {
    /**
     *
     * @param message
     * @returns
     */
    public match(message: Message): boolean {
        return isRequestMessage(message);
    }
    /**
     * 绑定
     *
     * 1、现校验字段
     *
     * @returns
     */
    public bind(@Inject(MiddlewareParamKey.socket) socket: Server | Client, @Inject(MiddlewareParamKey.transport) transport: Transport) {
        return async (message: Message) => {
            socket.request(message.action, message.params, (error, body) => {
                transport.callback(message, body, error);
            });
        };
    }
}
