import ClientSocket, { ClientSocketBindOptions, ClientSocketBindStatus, SocketMessage } from './client';
import Emitter from '../emitter';
import net, { Server, Socket } from 'net';

/**
 * 服务端状态
 */
export type ServerSocketStatus = 'stop' | 'running' | 'waiting' | 'pending';

/**
 * 服务端事件
 */
export type ServerSocketEvent = {
    error: (e: Error) => void;
    connect: (socket: Socket) => void;
    close: (server: Server) => void;
    listening: (Server: Server) => void;
    message: (client: ClientSocket, message: SocketMessage) => void;
};

/**
 * 服务端配置
 */
export interface ServerSocketOptions {
    serverId: string; // 名称
    secret?: string; // 密钥
    port: number; // 端口 default：31000
    host: string; // 地址 default：0.0.0.0
}

/**
 * 服务端的客户端配置
 */
export interface ServerSocketClient {
    client: ClientSocket;
    status: 'bind' | 'unbind';
}

/**
 * 服务端
 */
export default class ServerSocket extends Emitter<ServerSocketEvent> {
    // 链接对象
    private socket!: Server;

    // 状态
    public status: ServerSocketStatus = 'waiting';

    // 配置
    private options: ServerSocketOptions = { port: 31000, host: '0.0.0.0', serverId: 'Server' };

    // 客户端
    private clients: Map<string, ServerSocketClient> = new Map();

    constructor(options: ServerSocketOptions) {
        super(options.serverId);
        this.options = Object.assign(this.options, options || {});
        this.status = 'waiting';
        this.createServer();
    }

    /**
     * 停止
     */
    public stop() {
        this.log('[stop]');
        this.socket.close();
        this.status = 'stop';
        // 停止后把所有的客户端断开
        this.clients.forEach((c) => c.client.disconnect());
    }

    /**
     * 重启
     */
    public restart() {
        this.log('[restart]');
        this.socket.ref();
        this.status = 'waiting';
        this.createServer();
        this.start();
    }

    /**
     * 官博
     * @param data
     */
    public broadcast(...data: any[]) {}

    /**
     * 设置密钥
     *
     * 之前连接的会重新校验
     *
     * @param secret
     */
    public setSerct(secret: string) {
        Object.assign(this.options, { secret });
    }

    /**
     * 启动
     */
    public start() {
        this.log('[start]');
        this.status = 'pending';
        this.socket.listen(this.options.port);
    }

    // 建立服务器
    private createServer() {
        // 没有端口
        if (!this.options.port) {
            this.emit('error', new TypeError('port为空'));
        }

        // 创建服务器
        this.socket = net.createServer({ keepAlive: true }, (socket: Socket) => {
            // 临时id，绑定成功就会被移除
            const tempSocketId = `${this.options.serverId}-clientIndex-${this.clients.size}`;

            this.log('[connnect] 监听到客户端', socket.address(), socket.localAddress, tempSocketId);

            this.emit('connect', socket);

            const addressInfo = socket.address() as net.AddressInfo;
            // 建立客户端
            const client = new ClientSocket(
                {
                    port: addressInfo.port,
                    host: addressInfo.address,
                    type: 'server',
                    retry: false,
                    clientId: '',
                    serverId: this.options.serverId
                },
                socket
            );

            // 重新设置命名空间
            client.setNamespace(tempSocketId);

            // 临时绑定
            this.clients.set(tempSocketId, { status: 'unbind', client });

            // @todo 重新校验密钥

            // 处理绑定事件
            client.handleOnce('socket:bind', (bind: ClientSocketBindOptions) => {
                // 生成socketId
                const socketId = `${bind.clientId}-${this.options.serverId}`;

                this.log('[server-bind] 开始绑定服务端', bind);

                // 验证身份
                if (bind.serverId === this.options.serverId) {
                    if (!this.options.secret || this.options.secret === bind.secret) {
                        // 绑定成功
                        this.clients.set(socketId, { status: 'bind', client });
                        client.status = 'online';
                        this.success('[server-bind] 绑定服务端成功', bind);

                        // 移除临时绑定
                        client.setNamespace(socketId);
                        this.clients.delete(tempSocketId);
                        this.log('[socketId] socketId切换', `由${tempSocketId}正式切换到${socketId}`);

                        return {
                            ...bind,
                            status: ClientSocketBindStatus.success,
                            socketId,
                            serverId: this.options.serverId
                        };
                    }
                    this.debug('[server-bind] auth验证失败', bind, this.options);

                    return {
                        ...bind,
                        status: ClientSocketBindStatus.authError,
                        socketId,
                        serverId: this.options.serverId
                    };
                }

                // 返回失败信息
                this.debug('[server-bind] serverID验证失败', bind);
                return {
                    ...bind,
                    status: ClientSocketBindStatus.error,
                    socketId,
                    serverId: this.options.serverId
                };
            });

            // 处理消息
            client.on('message', (...args) => {
                this.emit('message', client, ...args);
            });
        });

        //设置监听时的回调函数
        this.socket.on('listening', () => {
            this.success('[listening]');
            this.status = 'running';
            this.emit('listening', this.socket);
        });

        //设置关闭时的回调函数
        this.socket.on('close', () => {
            this.log('[close]');
            this.socket.unref();
            this.socket.removeAllListeners();
            this.status = 'stop';
            this.emit('close', this.socket);
        });

        //设置出错时的回调函数
        this.socket.on('error', (e) => {
            this.debug('[error]', e);
            this.status = 'stop';
            this.emit('error', e);
        });
    }
}
