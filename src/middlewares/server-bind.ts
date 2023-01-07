import type ServerSocket from '../lib/socket/server';
import { ClientMiddleware, ClientSocketBindOptions } from '@/typings/socket';
import { SocketBindStatus } from '@/typings/enum';
import { SocketMessage, SocketMessageType } from '@/typings/message';
import Context from '@/lib/context';

/**
 * 服务端绑定插件
 * @param server
 * @param tempSocketId
 * @returns
 */
export default function serverBindMiddleware(server: ServerSocket, tempSocketId: string): ClientMiddleware {
    return (ctx: Context, next) => {
        if (ctx.body) {
            const message: SocketMessage = ctx.toJson();
            // 客户端来绑定
            if (message && typeof message === 'object' && message?.action && message?.msgId && message.action === 'socket:bind' && message.type === 'request') {
                const bind: ClientSocketBindOptions = message.content?.content || {};

                // 绑定目标id
                ctx.client.configure({ targetId: bind.clientId });

                // 生成socketId
                const socketId = `${server.options.serverId}-${bind.clientId}`;

                server.debug('[server-bind]', ' 收到客户端绑定信息', 'socketId:', socketId, 'requestId:', message.msgId);

                // 验证身份
                if (bind.serverId === server.options.serverId) {
                    // 校验密钥
                    if (!server.options.secret || server.options.secret === bind.secret) {
                        // 绑定成功
                        server.onlineClients.set(socketId, ctx.client);
                        ctx.client.status = 'online';
                        // log
                        server.success('[server-bind]', `绑定客户度端成功, 由${tempSocketId}正式切换到${socketId}`);

                        // 移除临时绑定
                        server.connectClients.delete(tempSocketId);

                        // 回传消息
                        ctx.json({
                            action: message.action,
                            msgId: message.msgId,
                            type: SocketMessageType.response,
                            content: {
                                content: {
                                    status: SocketBindStatus.success,
                                    socketId
                                }
                            }
                        });
                        return;
                    }

                    // 检验失败
                    server.logError('[server-bind]', 'auth验证失败', bind, server.options);
                    ctx.json({
                        action: message.action,
                        msgId: message.msgId,
                        type: SocketMessageType.response,
                        content: {
                            content: {
                                status: SocketBindStatus.authError,
                                socketId
                            }
                        }
                    });
                    return;
                }

                // 返回失败信息
                server.logError('[server-bind] serverID验证失败', bind, server.options);
                ctx.json({
                    action: message.action,
                    msgId: message.msgId,
                    type: SocketMessageType.response,
                    content: {
                        content: {
                            status: SocketBindStatus.error,
                            socketId
                        }
                    }
                });
                return;
            }

            // 客户端绑定结果
            if (message && typeof message === 'object' && message?.action && message?.msgId && message.action === 'socket:online' && message.type === 'request') {
                const { clientId } = message.content.content;
                server.success('[client-online]', '客户端上线:', clientId);
                server.emit('online', clientId);
                return;
            }
        }
        next();
    };
}
