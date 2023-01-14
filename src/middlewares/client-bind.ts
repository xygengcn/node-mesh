import Context from '@/lib/context';
import BaseError from '@/lib/error';
import { SocketSysEvent, SocketSysMsgContent, SocketSysMsgOnlineOrOfflineContent } from '@/typings/message';
import { ClientMiddleware, ClientSocketBindOptions, ServerSocketBindResult, SocketBindStatus } from '@/typings/socket';
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
        const sysMsgContent: SocketSysMsgContent<ClientSocketBindOptions> = {
            content: {
                clientId: ctx.id,
                serverId: ctx.client.targetId,
                status: SocketBindStatus.waiting,
                port: addressInfo.port,
                host: addressInfo.address,
                secret: secret,
                responseActions: ctx.client.responseKeys()
            },
            event: SocketSysEvent.socketBind
        };

        ctx.debug('[bindServer]', '开始绑定验证服务端', sysMsgContent);

        // 防止客户端绑定
        if (ctx.client.isServer) {
            throw new BaseError(30008, 'Server 不存在 bind 方法');
        }
        // 等待绑定
        if (ctx.client.status === 'binding') {
            // 发送绑定事件到客户端
            ctx.client.emit('beforeBind', sysMsgContent.content, ctx.socket);
            ctx.client.request(SocketSysEvent.socketBind, sysMsgContent, (error, result: SocketSysMsgContent<ServerSocketBindResult>) => {
                // 日志.
                ctx.debug('[afterBind]', result, error);
                // 收到回调
                ctx.client.emit('afterBind', result.content, ctx.socket);

                // 存在的错误，绑定失败
                if (error || result.content.status !== SocketBindStatus.success) {
                    ctx.logError('[bind:error] ', new BaseError(30009, error || 'Client bind error'));
                    ctx.client.disconnect(error || new BaseError(30009, error || 'Client bind error'));
                    return;
                }

                // 成功登录
                ctx.client.status = 'online';
                ctx.success('[online]', ctx.id);

                // 通知服务端上线了
                ctx.log('[online]', '通知服务端，客户端绑定成功');

                // 发送消息
                ctx.broadcast<SocketSysMsgOnlineOrOfflineContent>(SocketSysEvent.socketOnline, {
                    event: SocketSysEvent.socketOnline,
                    content: { clientId: ctx.id, serverId: ctx.client.targetId }
                });

                // 上线了
                ctx.client.emit('online', ctx.socket);
            });
        }
        next();
    };
}
