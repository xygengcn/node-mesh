import { ClientMiddleware, SocketMessage } from '@/typings/socket';
import Message from 'amp-message';
import type { ClientSocket } from '..';

/**
 *
 *
 * 隐藏指令中间件
 *
 *
 *
 * @returns
 */
export function clientSocketSysMessageMiddleware(): ClientMiddleware {
    return (client: ClientSocket, next) => {
        if (client.body) {
            const messages = new Message(client.body);
            const message: SocketMessage = messages?.args?.[0];
            // 系统指令
            if (message && typeof message === 'object' && message?.action && message?.requestId && /^socket:.+$/i.test(message.action)) {
                client.log('[message-hide]', '系统隐藏事件', 'messageId: ', message.requestId, 'action: ', message.action, 'type: ', message.type);
                // 回答别人的请求
                if (message.type === 'request') {
                    client.emit(message.action as any, message, (body: any, error: Error | null = null) => {
                        client.debug('[message-hide-send]', '回调', 'messageId: ', message.requestId, 'body: ', body);
                        if (body) {
                            client.sendMessage({
                                action: message.action,
                                requestId: message.requestId,
                                type: 'response',
                                error,
                                body
                            });
                        }
                    });
                } else {
                    client.log('[message-hide-callback]', '收到系统隐藏指令的回调', 'requestId: ', message.requestId);
                    // 触发请求回调
                    client.emit(message.requestId as any, message.error, message.body);
                }
                return true;
            }
        }
        next();
    };
}
