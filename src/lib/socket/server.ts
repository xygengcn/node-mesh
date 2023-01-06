import serverBindMiddleware from '@/middlewares/server-bind';
import { SocketType } from '@/typings/enum';
import { SocketMessage } from '@/typings/message';
import { ServerSocketOptions, SocketResponseAction } from '@/typings/socket';
import { uuid } from '@/utils';
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
    error: (e: Error) => void; // server error
    connect: (socket: Socket) => void; // client connect
    close: (server: Server) => void; // server close
    listening: (Server: Server) => void; // server running
    data: (buf: Buffer, client: ClientSocket) => void; // client send data
    message: (message: SocketMessage, client: ClientSocket) => void; // // client send message
    online: (clientId: string) => void; // client online
};

/**
 * 服务端
 */
export default class ServerSocket extends Emitter<ServerSocketEvent> {
    // 链接对象
    private socket!: Server;

    // 状态
    public status: ServerSocketStatus = 'waiting';

    // 配置
    public options: ServerSocketOptions = { port: 31000, host: '0.0.0.0', serverId: 'Server' };

    // 客户端
    public onlineClients: Map<string, ClientSocket> = new Map();

    // 临时客户端
    public connectClients: Map<string, ClientSocket> = new Map();

    // 记录注册的函数 response：是否回调给客户端
    private serverHandleActionMap: Map<string, { action: SocketResponseAction; response: boolean }> = new Map();

    // 构造函数
    constructor(options: ServerSocketOptions) {
        const namespace = `Server-${options.serverId}`;
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
        this.onlineClients.forEach((c) => c.disconnect());
        this.connectClients.forEach((c) => c.disconnect());
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
                const socket = this.onlineClients.get(socketId);
                if (socket) {
                    return socket.request(action, data);
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
        const tempSocketId = `temp-${this.options.serverId}-${uuid()}`;

        this.log('[connnect]', '监听到客户端', 'address: ', socket.address(), 'localAddress: ', socket.localAddress, '临时id: ', tempSocketId);

        this.emit('connect', socket);

        const addressInfo = socket.address() as net.AddressInfo;
        // 建立客户端
        const client = new ClientSocket(
            {
                port: addressInfo.port,
                host: addressInfo.address,
                type: SocketType.server,
                retry: false,
                clientId: this.options.serverId,
                targetId: ''
            },
            socket
        );

        // 临时绑定
        this.connectClients.set(tempSocketId, client);

        // 处理绑定事件
        client.use('data', serverBindMiddleware(this, tempSocketId));

        // 消息通知
        client.on('data', (buf) => {
            this.emit('data', buf, client);
        });

        // 注册事件
        this.serverHandleActionMap.forEach((value, action) => {
            client.response(action, value.action);
        });

        // 处理消息
        client.on('message', (msg) => {
            this.log('[server-message]', '服务端收到数据: ', msg?.msgId, 'action:', msg?.action);
            this.emit('message', msg, client);
        });
    }
}
