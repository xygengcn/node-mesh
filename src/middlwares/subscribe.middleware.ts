import { Inject, Middleware } from '@/decorator';
import type Client from '@/lib/client';
import { Message, isPushMessage } from '@/lib/message';
import type Server from '@/lib/server';
import { MiddlewareClass, MiddlewareParamKey } from '../lib/middleware/index';

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
    public bind(@Inject(MiddlewareParamKey.server) server: Server, @Inject(MiddlewareParamKey.client) client: Client) {
        return async (message: Message) => {
            if (client) {
                client.$emit('subscribe', message.action, ...(message.params || []));
                client.transport.subscriber.pub(message.action, ...(message.params || []));
            } else {
                if (server.subscriber.hasSub(message.action)) {
                    server.$emit('subscribe', message.action, ...(message.params || []));
                }
                server.publish(message.action, ...(message.params || []));
            }
        };
    }
}
