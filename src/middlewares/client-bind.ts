import Context from '@/lib/context';
import BaseError from '@/lib/error';
import { SocketMessageType, SocketSysEvent, SocketSysMsgContent } from '@/typings/message';
import { ClientMiddleware, ClientSocketBindOptions, SocketBindStatus } from '@/typings/socket';
import { AddressInfo } from 'net';

/**
 * 绑定中间件
 *
 *
 * 绑定服务端，此动作在客户端执行
 *
 *
 *
 * @returns
 */
export function clientSocketBindMiddleware(secret: string | undefined): ClientMiddleware {
    return (ctx: Context, next) => {
        // 等待绑定状态
        ctx.client.status = 'binding';

        // 地址
        const addressInfo = ctx.socket.address() as AddressInfo;

        // 绑定数据
        const content: ClientSocketBindOptions = {
            status: SocketBindStatus.waiting,
            port: addressInfo.port,
            host: addressInfo.address,
            clientId: ctx.id,
            serverId: ctx.client.targetId,
            secret: secret,
            responseActions: ctx.client.responseKeys()
        };

        ctx.debug('[bindServer]', '开始绑定验证服务端', content);

        // 防止客户端绑定
        if (ctx.client.isServer) {
            throw new BaseError(30008, 'Server 不存在 bind 方法');
        }
        // 等待绑定
        if (ctx.client.status === 'binding') {
            // 发送绑定事件到客户端
            ctx.client.emit('beforeBind', content, ctx.socket);
            ctx.client.request(SocketSysEvent.socketBind, content, (error, result: ClientSocketBindOptions) => {
                // 收到回调
                ctx.client.emit('afterBind', result, ctx.socket);

                // 日志.
                ctx.debug('[afterBind]', result, error);

                // 绑定失败
                if (error || result.status !== SocketBindStatus.success) {
                    ctx.logError('[bind:error] ', ctx.client.status, result, error);
                    ctx.client.disconnect(error || new BaseError(30009, error || 'Client bind error'));
                    return;
                }

                // 成功登录
                ctx.client.status = 'online';
                ctx.success('[online]', ctx.id);

                // 通知服务端上线了
                ctx.log('[online]', '通知服务端，客户端绑定成功');
                ctx.json<SocketSysMsgContent>({
                    action: SocketSysEvent.socketOnline,
                    type: SocketMessageType.notification,
                    content: {
                        content: {
                            content: null,
                            clientId: ctx.id,
                            serverId: ctx.client.targetId,
                            event: SocketSysEvent.socketOnline
                        }
                    }
                });

                // 上线了
                ctx.client.emit('online', ctx.socket);
            });
        }
        next();
    };
}
