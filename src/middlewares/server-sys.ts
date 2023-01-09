import Context from '@/lib/context';
import { SocketMessage, SocketMessageType, SocketSysEvent, SocketSysMsgContent, SocketSysMsgOnlineOrOfflineContent } from '@/typings/message';
import { ClientMiddleware } from '@/typings/socket';
import type ServerSocket from '../lib/socket/server';

/**
 * 服务端系统通知
 *
 * 上线有消息通知，下线是从end/close监听到
 * @param server
 * @returns
 */
export default function serverSysMsgMiddleware(server: ServerSocket): ClientMiddleware {
    return (ctx: Context, next) => {
        if (ctx.body) {
            const message: SocketMessage = ctx.toJson();
            // 系统通知
            if (
                message &&
                typeof message === 'object' &&
                message?.action &&
                message?.msgId &&
                /^socket:.+$/i.test(message?.action) &&
                message.type === SocketMessageType.notification
            ) {
                const sysMsgContent = message.content.content as SocketSysMsgContent;
                switch (message.action) {
                    case SocketSysEvent.socketOnline: {
                        // 客户端上线
                        server.success('[client-online]', '客户端上线:', (sysMsgContent as SocketSysMsgOnlineOrOfflineContent).content.clientId);

                        // 通知其他客户端上线
                        server.broadcast<SocketSysMsgContent>(
                            {
                                action: SocketSysEvent.socketOnline,
                                type: SocketMessageType.notification,
                                content: {
                                    content: sysMsgContent
                                }
                            },
                            (client) => {
                                // 过滤掉自己的
                                return client.socket.targetId !== (sysMsgContent as SocketSysMsgOnlineOrOfflineContent).content.clientId;
                            }
                        );
                        break;
                    }
                }
                server.emit('sysMessage', sysMsgContent);

                return;
            }
        }
        next();
    };
}
