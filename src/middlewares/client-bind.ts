import { ClientSocketBindStatus } from '@/typings/enum';
import { ClientMiddleware, ClientSocketBindOptions } from '@/typings/socket';
import { AddressInfo } from 'net';
import type { ClientSocket } from '..';

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
    return (client: ClientSocket, next) => {
        // 等待绑定状态
        client.status = 'binding';

        // 地址
        const addressInfo = client.socket.address() as AddressInfo;

        // 绑定数据
        const content: ClientSocketBindOptions = {
            status: ClientSocketBindStatus.waiting,
            port: addressInfo.port,
            host: addressInfo.address,
            clientId: client.options.id,
            serverId: client.options.targetId,
            secret: client.options.secret
        };

        client.debug('[bindServer]', '开始绑定验证服务端', client.status, content);
        if (client.options.type === 'server') {
            throw new Error('server 不存在 bind 方法');
        }
        // 等待绑定
        if (client.status === 'binding') {
            // 发送绑定事件到客户端
            client.emit('beforeBind', content, client.socket);
            client.request('socket:bind', content, (error, result: ClientSocketBindOptions) => {
                // 收到回调
                client.emit('afterBind', result, client.socket);

                // 日志.
                client.debug('[afterBind]', result, error);

                // 绑定失败
                if (error || result.status !== ClientSocketBindStatus.success) {
                    client.logError('[bind:error] ', client.status, result, error);
                    client.disconnect(error || new Error('Client bind error', { cause: { result, error } }));
                    return;
                }

                // 成功登录
                client.status = 'online';
                client.success('[online]', client.options.id);

                // 通知服务端上线了
                client.log('[online]', '通知服务端，客户端绑定成功');
                client.send({
                    action: 'socket:online',
                    params: {
                        clientId: client.options.id
                    }
                });

                // 上线了
                client.emit('online', client.socket);
            });
        }
        next();
    };
}
