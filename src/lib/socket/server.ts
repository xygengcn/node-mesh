import { ClientSocketBindOptions, ClientSocketBindStatus, ServerSocketBindResult, SocketMessage, SocketResponseAction } from '@/typings/socket';
import net, { Server, Socket } from 'net';
import Emitter from '../emitter';
import ClientSocket from './client';

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
    data: (buf: Buffer) => void;
    message: (message: SocketMessage, client: ClientSocket) => void;
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
    private clientsMap: Map<string, ServerSocketClient> = new Map();

    // 记录注册的函数 response：是否回调给客户端
    private serverHandleActionMap: Map<string, { action: SocketResponseAction; response: boolean }> = new Map();

    // 构造函数
    constructor(options: ServerSocketOptions) {
        const namespace = `serverSocket-${options.serverId}`;
        super(namespace);
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
        this.clientsMap.forEach((c) => c.client.disconnect());
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
     * 发送消息
     * @param clientId
     * @param action
     * @param data
     * @returns
     */
    public request<T = any>(clientId: string, action: string, data: string | number | object): Promise<T> {
        if (this.status === 'running') {
            if (clientId && action) {
                const socketId = `${this.options.serverId}-${clientId}`;
                const socket = this.clientsMap.get(socketId);
                if (socket?.status === 'bind' && socket.client) {
                    return socket.client.request(action, data);
                }
                return Promise.reject(Error('client is not binding'));
            }
            return Promise.reject(Error('clientId and Action is required'));
        }
        return Promise.reject(Error('server is not running'));
    }

    /**
     * 回答事件
     * @param action
     * @param callback
     */
    public response(action: string, callback: SocketResponseAction) {
        this.serverHandleActionMap.set(action, { action: callback, response: true });
    }

    // /**
    //  * 移除回答事件
    //  * @param action
    //  */
    // public removeResponse(action: string) {
    //     this.serverHandleActionMap.delete(action);
    // }

    /**
     * 重新设置配置
     *
     * @param options
     */
    public setDefaultOptions(options: Partial<Pick<ServerSocketOptions, 'secret'>>) {
        Object.assign(this.options, options || {});
    }

    /**
     * 启动
     */
    public start() {
        this.log('[start]');
        this.status = 'pending';
        this.socket.listen(this.options.port);
    }

    /**
     * 建立服务器
     */
    private createServer() {
        // 没有端口
        if (!this.options.port) {
            this.emit('error', new TypeError('port为空'));
        }

        // 创建服务器
        this.socket = net.createServer({ keepAlive: true }, this.handleClientConnect.bind(this));

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
            this.logError('[error]', e);
            this.status = 'stop';
            this.emit('error', e);
        });
    }

    /**
     * 处理客户端事件
     * @param socket Socket
     */

    private handleClientConnect(socket: Socket) {
        // 临时id，绑定成功就会被移除
        const tempSocketId = `temp-${this.options.serverId}-clientIndex-${this.clientsMap.size}`;

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
                id: this.options.serverId,
                targetId: ''
            },
            socket
        );

        // 临时绑定
        this.clientsMap.set(tempSocketId, { status: 'unbind', client });

        // 处理绑定事件
        client.once('socket:bind', this.handleClientBindEvent.bind(this, tempSocketId, client));

        // 消息通知
        client.on('data', (buf) => {
            this.emit('data', buf);
        });

        // 注册事件
        this.serverHandleActionMap.forEach((value, action) => {
            client.response(action, value.action);
        });

        // 处理消息
        client.on('message', (msg) => {
            this.log('[server-message]', '服务端收到数据: ', msg?.requestId, 'action:', msg?.action);
            this.emit('message', msg, client);
        });
    }

    /**
     * 处理客户端绑定事件
     * @param tempSocketId
     * @param bind
     * @returns
     */
    private handleClientBindEvent(
        tempSocketId: string,
        client: ClientSocket,
        message: SocketMessage<ClientSocketBindOptions>,
        send: (content: ServerSocketBindResult) => void
    ): void {
        const bind = message.params;
        // 生成socketId
        const socketId = `${this.options.serverId}-${bind.clientId}`;

        this.debug('[server-bind] 开始绑定服务端', 'socketId: ', socketId, message, this.options);

        // 验证身份
        if (bind.serverId === this.options.serverId) {
            if (!this.options.secret || this.options.secret === bind.secret) {
                // 绑定成功
                this.clientsMap.set(socketId, { status: 'bind', client });
                client.status = 'online';
                this.success('[server-bind] 绑定服务端成功', bind);

                // 绑定目标id
                client.setDefaultOptions({ targetId: bind.clientId });

                // 移除临时绑定
                this.clientsMap.delete(tempSocketId);
                this.log('[socketId] socketId切换', `由${tempSocketId}正式切换到${socketId}`);

                return send({
                    status: ClientSocketBindStatus.success,
                    socketId
                });
            }
            this.logError('[server-bind] auth验证失败', bind, this.options);
            return send({
                status: ClientSocketBindStatus.authError,
                socketId
            });
        }

        // 返回失败信息
        this.logError('[server-bind] serverID验证失败', bind, this.options.serverId);
        return send({
            status: ClientSocketBindStatus.error,
            socketId
        });
    }
}
