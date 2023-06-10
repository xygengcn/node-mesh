import { Transport } from '@/lib/transport';
import { Inject, Middleware } from '@/decorator';
import { Message, MessageSysAction, isSysMessage } from '@/lib/message';
import type Server from '@/lib/server';
import { MiddlewareClass, MiddlewareParamKey } from '../lib/middleware/index';

/**
 * 心跳
 */
@Middleware()
export default class HearbeatMiddleware implements MiddlewareClass {
    /**
     *
     * @param message
     * @returns
     */
    public match(message: Message): boolean {
        return isSysMessage(message) && message.action === MessageSysAction.heartbeat;
    }
    /**
     * 绑定
     *
     * 1、现校验字段
     *
     * @returns
     */
    public bind(@Inject(MiddlewareParamKey.server) server: Server, @Inject(MiddlewareParamKey.transport) transport: Transport) {
        return async (message: Message) => {
            server.$debug('[heartbeat]', transport.sender.socket.remoteId());
            transport.callback(message, { result: true }, null);
        };
    }
}
