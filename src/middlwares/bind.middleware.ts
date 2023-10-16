import { Inject, Middleware } from '@/decorator';
import CustomError, { CustomErrorCode } from '@/error';
import type Client from '@/lib/client';
import { ISystemMessage, Message, MessageSource, MessageSysAction, isCallbackMessage, isSysMessage } from '@/lib/message';
import { SocketStatus } from '@/lib/socket';
import { MiddlewareClass, MiddlewareParamKey } from '../lib/middleware/index';

/**
 * 绑定中间件
 *
 * 客户端中间件
 */

@Middleware()
export default class BindMiddleware implements MiddlewareClass {
    /**
     *
     * @param message
     * @returns
     */
    public match(message: Message): boolean {
        return isSysMessage(message) && isCallbackMessage(message) && message.action === MessageSysAction.connected;
    }
    /**
     * 绑定
     * @returns
     */
    public bind(@Inject(MiddlewareParamKey.client) client: Client) {
        return () => {
            client.$debug('[binding]');
            if (client.socket?.status === SocketStatus.connected) {
                // 生成系统消息
                const message = new Message<ISystemMessage>();

                // 添加系统能力
                message.setSource(MessageSource.system);

                // keys
                const responderName = client.responder.toLocalEvents();

                // 订阅
                const subscriberName = client.transport.subscriber.toEventNames();

                // 添加参数
                message.setParams(client.options.namespace, client.options.auth, responderName, subscriberName);

                // 添加动作
                message.setAction(MessageSysAction.bindAuth);

                // 开启绑定
                client.socket.updateStatus(SocketStatus.binding);

                // 发起请求client
                client.transport.request(message, (error, content) => {
                    client.$debug('[binded]', error || content || '');
                    if (error) {
                        client.$emit('error', error);
                        // 手动断开链接
                        client.disconnect();
                        return;
                    }

                    // 注册方法到服务端
                    client.register();

                    // 通知消息
                    client.socket.$emit('online');
                });

                return;
            }
            client.$emit('error', new CustomError(CustomErrorCode.bindError, '绑定失败'));
        };
    }
}
