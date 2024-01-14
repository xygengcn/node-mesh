import { Inject, Middleware } from '@/decorator';
import type Client from '@/lib/client';
import { Message, MessageSysAction, isNotificationMessage, isSysMessage } from '@/lib/message';
import { MiddlewareClass, MiddlewareParamKey } from '../lib/middleware/index';

/**
 * 断开中间件
 *
 * 客户端中间件
 */

@Middleware()
export default class DisconnectMiddleware implements MiddlewareClass {
    /**
     *
     * @param message
     * @returns
     */
    public match(message: Message): boolean {
        return isSysMessage(message) && isNotificationMessage(message) && message.action === MessageSysAction.disconnect;
    }
    /**
     * 绑定
     * @returns
     */
    public bind(@Inject(MiddlewareParamKey.client) client: Client) {
        return (message: Message) => {
            client.$debug('[disconnect-message]', message.fromId, message.error);
            client.disconnect();
        };
    }
}
