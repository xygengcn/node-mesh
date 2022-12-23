import Message from 'amp-message';
import { ClientSocket, ServerSocket } from '..';
import { ClientMiddleware, ClientSocketBindOptions, SocketMessage } from '@/typings/socket';
import { ClientSocketBindStatus } from '@/typings/enum';

/**
 * 服务端绑定插件
 * @param server
 * @param tempSocketId
 * @returns
 */
export default function serverBindMiddleware(server: ServerSocket, tempSocketId: string): ClientMiddleware {
    return (client: ClientSocket, next) => {
        if (client.body) {
            const messages = new Message(client.body);
            const message: SocketMessage = messages?.args?.[0];
            // 客户端来绑定
            if (message && typeof message === 'object' && message?.action && message?.requestId && message.action === 'socket:bind' && message.type === 'request') {
                const bind: ClientSocketBindOptions = message.params;

                // 绑定目标id
                client.setDefaultOptions({ targetId: bind.clientId });

                // 生成socketId
                const socketId = `${server.options.serverId}-${bind.clientId}`;

                server.debug('[server-bind]', ' 收到客户端绑定信息', 'socketId:', socketId, 'requestId:', message.requestId);

                // 验证身份
                if (bind.serverId === server.options.serverId) {
                    // 校验密钥
                    if (!server.options.secret || server.options.secret === bind.secret) {
                        // 绑定成功
                        server.onlineClients.set(socketId, client);
                        client.status = 'online';
                        // log
                        server.success('[server-bind]', `绑定客户度端成功, 由${tempSocketId}正式切换到${socketId}`);

                        // 移除临时绑定
                        server.connectClients.delete(tempSocketId);

                        // 回传消息
                        client.send({
                            action: message.action,
                            requestId: message.requestId,
                            type: 'response',
                            body: {
                                status: ClientSocketBindStatus.success,
                                socketId
                            }
                        });
                        return;
                    }

                    // 检验失败
                    server.logError('[server-bind]', 'auth验证失败', bind, server.options);
                    client.send({
                        action: message.action,
                        requestId: message.requestId,
                        type: 'response',
                        body: {
                            status: ClientSocketBindStatus.authError,
                            socketId
                        }
                    });
                    return;
                }

                // 返回失败信息
                server.logError('[server-bind] serverID验证失败', bind, server.options);
                client.send({
                    action: message.action,
                    requestId: message.requestId,
                    type: 'response',
                    body: {
                        status: ClientSocketBindStatus.error,
                        socketId
                    }
                });
                return;
            }

            // 客户端绑定结果
            if (message && typeof message === 'object' && message?.action && message?.requestId && message.action === 'socket:online' && message.type === 'request') {
                const { clientId } = message.params;
                server.success('[client-online]', '客户端上线:', clientId);
                server.emit('online', clientId);
                return;
            }
        }
        next();
    };
}
