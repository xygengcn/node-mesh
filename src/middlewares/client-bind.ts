import Context from '@/lib/context';
import BaseError from '@/lib/error';
import { SocketBindStatus } from '@/typings/enum';
import { ClientMiddleware, ClientSocketBindOptions } from '@/typings/socket';
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
export function clientSocketBindMiddleware(): ClientMiddleware {
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
            serverId: ctx.client.options.targetId,
            secret: ctx.client.options.secret,
            responseActions: ctx.client.responseKeys()
        };

        ctx.debug('[bindServer]', '开始绑定验证服务端', content);
        if (ctx.client.options.type === 'server') {
            throw new BaseError(30008, 'Server 不存在 bind 方法');
        }
        // 等待绑定
        if (ctx.client.status === 'binding') {
            // 发送绑定事件到客户端
            ctx.client.emit('beforeBind', content, ctx.socket);
            ctx.client.request('socket:bind', content, (error, result: ClientSocketBindOptions) => {
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
                ctx.json({
                    action: 'socket:online',
                    content: {
                        content: {
                            clientId: ctx.id
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
