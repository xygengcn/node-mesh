import BaseError from '@/lib/error';
import type ServerSocket from '../lib/socket/server';
import { ClientMiddleware, ClientSocketBindOptions, ServerSocketBindResult, SocketBindStatus, SocketType } from '@/typings/socket';
import { SocketMessage, SocketSysEvent, SocketSysMsgContent } from '@/typings/message';
import Context from '@/lib/context';

/**
 * 服务端绑定插件
 * @param server
 * @param tempSocketId
 * @returns
 */
export default function serverBindMiddleware(server: ServerSocket): ClientMiddleware {
    return (ctx: Context, next) => {
        if (ctx.body) {
            const message: SocketMessage = ctx.toJson();
            // 客户端来绑定
            if (message && typeof message === 'object' && message?.action && message?.msgId && message.action === SocketSysEvent.socketBind && message.type === 'request') {
                const sysMessageContent: SocketSysMsgContent<ClientSocketBindOptions> = message.content?.content || {};

                // 绑定数据
                const bind: ClientSocketBindOptions = sysMessageContent.content;

                // 绑定目标id
                ctx.client.configure({ targetId: bind.clientId });

                // 生成socketId
                const socketId = ctx.client.getSocketId();

                // 获取客户端
                const client = server.clients.get(socketId);
                if (client) {
                    client.clearBindSetTimeout();
                } else {
                    server.logError('[server-bind]', new BaseError(30009, new Error(socketId + '客户端不存在')));
                    return;
                }

                server.debug('[server-bind]', ' 收到客户端绑定信息', 'socketId:', socketId, 'requestId:', message.msgId);

                // 验证身份
                if (bind.serverId === server.serverId) {
                    // 校验密钥
                    if (server.checkSecret(bind.secret)) {
                        // log
                        server.success('[server-bind]', '绑定客户度端成功:', bind.clientId, '注册方法', bind.responseActions.length, '订阅', bind.subscription.length);

                        // 状态在线
                        ctx.client.status = 'online';
                        // 绑定成功
                        const responseActions = bind.responseActions || [];

                        // 开始注册动作
                        responseActions.forEach((actionKey) => {
                            // 把客户端带过来的keys放到服务端对应的客户端副本
                            client.responseActionKeys.add(actionKey);
                            // 注册到服务端，如果注册过，则移除
                            if (server.responseAction.has(actionKey)) {
                                const response = server.responseAction.get(actionKey);
                                // 服务端优先级高
                                if (response?.type === SocketType.server) {
                                    return;
                                }
                                server.debug('[response]', '移除注册的动作：', actionKey, '客户端：', response?.socketId || '');
                            }
                            // 注册新动作
                            server.debug('[response]', '注册新动作：', actionKey, '客户端：', socketId);
                            server.responseAction.set(actionKey, { type: SocketType.client, socketId });
                        });

                        // 处理订阅数据
                        bind.subscription.forEach((key) => {
                            // 添加订阅
                            client.subscribe(key);
                        });

                        // 回传消息
                        ctx.json<SocketSysMsgContent<ServerSocketBindResult>>({
                            event: SocketSysEvent.socketBind,
                            content: {
                                status: SocketBindStatus.success
                            }
                        });
                        return;
                    }

                    // 检验失败
                    server.logError('[server-bind]', new BaseError(30009, new Error('auth验证失败', { cause: { bind } })));
                    ctx.json<SocketSysMsgContent<ServerSocketBindResult>>({
                        event: SocketSysEvent.socketBind,
                        content: {
                            status: SocketBindStatus.authError
                        }
                    });
                    return;
                }

                // 返回失败信息
                server.logError('[server-bind]', new BaseError(30009, new Error('serverID验证失败', { cause: { bind } })));
                ctx.json<SocketSysMsgContent<ServerSocketBindResult>>({
                    event: SocketSysEvent.socketBind,
                    content: {
                        status: SocketBindStatus.error
                    }
                });
                return;
            }
        }
        next();
    };
}
