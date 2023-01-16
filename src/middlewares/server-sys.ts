import Context from '@/lib/context';
import { SocketBroadcastMsgContent, SocketMessage, SocketMessageType, SocketSysEvent, SocketSysMsgOnlineOrOfflineContent, SocketSysMsgContent } from '@/typings/message';
import { ClientMiddleware } from '@/typings/socket';
import type ServerSocket from '../lib/socket/server';

/**
 * 服务端系统通知
 *
 * 上线有消息通知，下线是从end/close监听到
 *
 * 系统消息都是广播消息
 *
 * @param server
 * @returns
 */
export default function serverSysMsgMiddleware(server: ServerSocket): ClientMiddleware {
    return (ctx: Context, next) => {
        if (ctx.body) {
            const message: SocketMessage = ctx.toJson();
            // 广播消息
            if (message && typeof message === 'object' && message?.action && message?.msgId && message.type === SocketMessageType.broadcast) {
                const sysMsgContent = message.content.content as SocketBroadcastMsgContent;
                switch (message.action) {
                    case SocketSysEvent.socketOnline: {
                        // 客户端上线
                        server.success('[client-online]', '客户端上线:', (sysMsgContent as SocketSysMsgOnlineOrOfflineContent).content.clientId);
                        break;
                    }
                }
                // 系统通知
                if (/^socket:.+$/i.test(message?.action)) {
                    server.emit('sysMessage', sysMsgContent as SocketSysMsgContent);
                }
                // 默认广播消息
                server.emit('broadcast', sysMsgContent);

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
