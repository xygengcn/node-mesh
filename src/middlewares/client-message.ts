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
export function clientSocketMessageMiddleware(): ClientMiddleware {
    return async (client: ClientSocket, next) => {
        const messages = client.body && new Message(client.body);
        const message: SocketMessage = messages?.args?.[0];
        if (message && typeof message === 'object') {
            if (message.action && message.targetId === client.options.id && message.requestId) {
                // log
                client.debug('[message]', message);
                // 在线状态再触发，是固定消息模式
                if (client.status === 'online') {
                    client.emit('message', message);
                }

                // 自己发出request请求，别人回答了，收到回调 如果是在线状态需要校验targetId
                if (message.type === 'response') {
                    // 日志
                    client.log('[message-response]', '这是一条回调消息:', message?.requestId);
                    // 触发请求回调
                    client.emit(message.requestId as any, message.error, message.body);
                    return;
                }

                // 收到别人的request请求，并回答它，如果是在线状态需要校验targetId
                if (message.type === 'request') {
                    // 获取执行函数
                    const event = client.clientHandleResponseMap.get(message.action);

                    // 存在回调
                    client.log('[message-request]', '这是一条请求消息:', message.requestId, 'event:', !!event);

                    // 结果
                    let body = null;

                    // 错误
                    let error = null;

                    // 执行函数
                    if (event && typeof event.callback === 'function') {
                        try {
                            // 运行注册函数
                            body = await event.callback(message.params || {});
                            // 一次性的
                            if (event.once) {
                                client.clientHandleResponseMap.delete(message.action);
                            }
                        } catch (e: any) {
                            error = e;
                        }
                    }

                    client.send({
                        action: message.action,
                        requestId: message.requestId,
                        type: 'response',
                        error,
                        body
                    });
                    return;
                }
            }

            // 普通消息，不处理
            client.log('[message]', '收到消息不处理', message.requestId);
        }
        next();
    };
}
