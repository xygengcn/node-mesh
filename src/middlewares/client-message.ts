import Context from '@/lib/context';
import { SocketMessage, SocketMessageType } from '@/typings/message';
import { ClientMiddleware } from '@/typings/socket';

/**
 *
 *
 * 隐藏指令中间件
 *
 *
 *
 * @returns
 */
export function clientMessageMiddleware(): ClientMiddleware {
    return async (ctx: Context, next) => {
        const message: SocketMessage = ctx.toJson();
        if (message && typeof message === 'object') {
            if (message.action && message.targetId === ctx.id && message.msgId) {
                // log
                ctx.debug('[message]', message);

                // 在线状态再触发，普通消息通知
                if (ctx.client.status === 'online') {
                    ctx.client.emit('message', message);
                }

                // 自己发出request请求，别人回答了，收到回调 如果是在线状态需要校验targetId
                if (message.type === SocketMessageType.response) {
                    // 日志
                    ctx.debug('[response-message]', '这是一条回调消息:', message.msgId);
                    // 触发请求回调
                    ctx.client.emit(`request:${message.msgId}`, message.content.developerMsg, message.content.content);
                    return;
                }

                // 收到订阅消息
                if (message.type === SocketMessageType.subscribe) {
                    // 日志
                    ctx.debug('[sub-message]', '收到订阅', message.action, '消息', message.msgId);

                    //  订阅回调
                    //  收到客户端的订阅消息，通知服务端
                    ctx.client.emit('subscribe', message);
                    // 客户端触发回调
                    if (!ctx.client.isServer) {
                        ctx.client.emit(`subscribe:${message.action}`, message.content.developerMsg, message.content.content);
                    }
                    return;
                }

                // 收到别人的request请求，并回答它，如果是在线状态需要校验targetId
                if (message.type === SocketMessageType.request) {
                    // 获取执行函数
                    const event = ctx.client.getResponse(message.action);

                    // 存在回调
                    ctx.debug('[message-request]', '这是一条请求消息:', message.msgId, 'event:', !!event);

                    // 结果
                    let content = null;

                    // 错误
                    let developerMsg = null;

                    // 执行函数
                    if (event && typeof event === 'function') {
                        try {
                            // 运行注册函数
                            content = await event.apply(undefined, message.content?.content || []);
                        } catch (e: any) {
                            developerMsg = e;
                        }
                    }

                    ctx.json<any>(content, developerMsg);
                    return;
                }
            }

            // 普通消息，不处理
            ctx.debug('[message]', '收到消息不处理', message.msgId);
        }
        next();
    };
}
