import { IHeartbeatOptions, Transport } from '@/lib/transport';
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
            const params = message.params[0] as IHeartbeatOptions;
            server.$debug('[heartbeat]', params);
            server.$emit('heartbeat', params);
            // 回调消息
            transport.callback(
                message,
                {
                    id: server.localId(),
                    name: server.options.namespace,
                    responderEvents: server.responder.toHandlerEvents(),
                    subscribeEvents: server.subscriber.toSubscribeEvents(),
                    memory: process.memoryUsage()
                } as IHeartbeatOptions,
                null
            );
            // 再次绑定资源
            server.bindConnectionEvents(params.id, params.responderEvents, params.subscribeEvents);
        };
    }
}
