import Context from '@/lib/context';
import BaseError from '@/lib/error';
import {
    SocketBroadcastMsgContent,
    SocketMessage,
    SocketMessageType,
    SocketSysEvent,
    SocketSysMsgOnlineOrOfflineContent,
    SocketSysMsgContent,
    SocketSysMsgSubscribeContent
} from '@/typings/message';
import { ClientMiddleware } from '@/typings/socket';
import type ServerSocket from '../lib/socket/server';

/**
 * 服务端系统通知消息
 * @param server
 * @param message
 */
async function serverSysNotificationMsg(server: ServerSocket, message: SocketMessage) {
    const sysMsgContent = message.content.content as SocketBroadcastMsgContent;
    switch (sysMsgContent.event) {
        case SocketSysEvent.socketOnline: {
            const count = await server.getConnections();
            // 客户端上线
            server.success(
                '[client-online]',
                '客户端上线:',
                (sysMsgContent as SocketSysMsgOnlineOrOfflineContent).content.clientId,
                (sysMsgContent as SocketSysMsgOnlineOrOfflineContent).content.socketId
            );
            server.debug('[client-online]', '当前客户端数量:', server.clients.size, '连接数量:', count);
            break;
        }
        case SocketSysEvent.socketSub: {
            const content: SocketSysMsgSubscribeContent['content'] = sysMsgContent.content;
            // 客户端上线
            server.debug('[client-sub]', '客户端订阅更新', message.targetId, content);

            // 开始处理
            if (content.socketId) {
                const client = server.clients.get(content.socketId);
                if (client) {
                    if (content.subscribe) {
                        client.subscribe(content.action);
                    } else {
                        client.unsubscribe(content.action);
                    }
                } else {
                    server.logError('[client-sub]', new BaseError({code:30017,message: '没找到客户端', cause:{content}}));
                }
            }

            break;
        }
    }
}

/**
 * 服务端广播消息
 *
 * 上线有消息通知，下线是从end/close监听到
 *
 * 系统消息都是广播消息
 *
 * @param server
 * @returns
 */
export default function serverSysMsgMiddleware(server: ServerSocket): ClientMiddleware {
    return async (ctx: Context, next) => {
        if (ctx.body) {
            const message = ctx.toJson() as SocketMessage<SocketSysMsgContent, SocketSysEvent>;
            // 广播消息
            if (message && typeof message === 'object' && message?.action && message?.msgId && message.type === SocketMessageType.broadcast && message.content?.content) {
                const sysMsgContent = message.content.content;

                // 日志
                server.log('[server-broadcast-receive]', '事件', sysMsgContent.event, '消息', message.msgId);

                // 系统通知
                if (/^socket:.+$/i.test(message?.action)) {
                    // 通知消息处理
                    await serverSysNotificationMsg(server, message);
                    // 回调
                    server.emit('sysMessage', sysMsgContent);
                }
                // 默认广播消息
                server.emit('broadcast', message.action, sysMsgContent);

                // 广播消息
                server.broadcast(
                    {
                        action: message.action,
                        msgId: message.msgId,
                        content: {
                            content: sysMsgContent
                        }
                    },
                    (client) => {
                        // 不推给自己
                        return client.targetId !== message.fromId;
                    }
                );
                return;
            }
        }
        next();
    };
}
