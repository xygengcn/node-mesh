import serverBindMiddleware from '@/middlewares/server-bind';
import { SocketType } from '@/typings/enum';
import { SocketMessage, SocketMessageType } from '@/typings/message';
import { ClientMiddleware, ServerSocketOptions, SocketResponseAction } from '@/typings/socket';
import { uuid } from '@/utils';
import net, { Server, Socket } from 'net';
import Context from '../context';
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
 * 服务端的动作注册
 */
type ServerSocketResponse =
    | {
          callback: SocketResponseAction;
          type: SocketType.server;
          socketId?: string;
      }
    | {
          type: SocketType.client;
          socketId: string;
      };

/**
 * 服务端上线的客户端
 */
interface ServerSocketOnlineClient {
    client: ClientSocket;
    responseActions: Set<string>;
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
    public options: ServerSocketOptions = { port: 31000, host: '0.0.0.0', serverId: 'Server' };

    // 客户端
    public onlineClients: Map<string, ServerSocketOnlineClient> = new Map();

    // 临时客户端
    public connectClients: Map<string, ClientSocket> = new Map();

    // 记录注册的函数 response：是否回调给客户端
    public responseAction: Map<string, ServerSocketResponse> = new Map();

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
        this.onlineClients.forEach((c) => c.client.disconnect());
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
     * 请求消息
     *
     * 俗称约定：action为socket:*为隐藏指令
     *
     *
     * @param action
     * @param params
     * @param callback
     */
    public request<T extends any = any>(action: string, params: string | number | object, callback: (error: Error | null, result: T) => void): void;
    public request<T = any>(action: string, params: string | number | object): Promise<T>;
    public async request(action, params, callback?): Promise<any> {
        // 日志
        this.log('[request]', '服务端请求，action:', action);

        if (!action || typeof action !== 'string') {
            return Promise.reject(Error('Action is required'));
        }

        // 先检测本地是否注册
        if (this.responseAction.has(action)) {
            if (typeof callback === 'function') {
                this.handleServerAction(action, params, callback);
                return;
            } else {
                return new Promise(async (resolve, reject) => {
                    this.handleServerAction(action, params, (error, result) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(result);
                        }
                    });
                });
            }
        }
        return Promise.reject(Error('Request is not exist'));
    }

    /**
     * 回答事件
     * @param action
     * @param callback
     */
    public response(action: string, callback: SocketResponseAction) {
        this.responseAction.set(action, { callback, type: SocketType.server });
    }

    /**
     * 重新设置配置
     *
     * @param options
     */
    public configure(options: Partial<Pick<ServerSocketOptions, 'secret'>>) {
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
     * 处理动作
     * @param action
     * @param params
     * @param callback
     */
    private async handleServerAction(action: string, params: string | number | object, callback: (error: Error | null, result: any) => void) {
        const responseAction: ServerSocketResponse = this.responseAction.get(action) as ServerSocketResponse;
        if (responseAction) {
            // 服务端的动作
            if (responseAction.type === SocketType.server) {
                let developerMsg: Error | null = null;
                let result = null;
                try {
                    result = await responseAction.callback.call(undefined, params || {});
                } catch (error: any) {
                    developerMsg = error;
                }
                callback(developerMsg, result);
                return;
            }
            // 客户端的动作
            if (responseAction.type === SocketType.client && responseAction.socketId) {
                if (this.status !== 'running') {
                    callback(Error('Server is not running'), null);
                    return;
                }
                // 有此客户端
                const socket = this.onlineClients.get(responseAction.socketId);

                // 客户端不在线
                if (socket?.client.status !== 'online') {
                    callback(Error('Action is not active'), null);
                    return;
                }

                // 客户端有这个动作
                if (socket && socket.responseActions.has(action) && socket.client.status === 'online') {
                    // 请求客户端
                    socket.client
                        .request(action, params)
                        .then((result) => {
                            callback(null, result);
                        })
                        .catch((e) => {
                            callback(e, null);
                        });
                }
            }
            return;
        }
        callback(Error('Action is not exist'), null);
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

        // 处理请求事件
        client.use('data', this.handleClientRequestEvent());

        // 消息通知
        client.on('data', (buf) => {
            this.emit('data', buf, client);
        });

        // 处理消息
        client.on('message', (msg) => {
            this.log('[server-message]', '服务端收到数据: ', msg?.msgId, 'action:', msg?.action);
            this.emit('message', msg, client);
        });
    }

    /**
     * 处理客户端请求事件
     */
    private handleClientRequestEvent(): ClientMiddleware {
        return async (ctx: Context, next) => {
            const message: SocketMessage = ctx.toJson();
            if (message && typeof message === 'object' && message.action && message.type === 'request' && message.targetId === ctx.id && message.msgId) {
                this.debug('[client-request]', '来自客户端的请求:', message);
                if (this.responseAction.has(message.action)) {
                    // 注册方法
                    this.handleServerAction(message.action, message.content?.content || '', (developerMsg, content) => {
                        ctx.json({
                            action: message.action,
                            msgId: message.msgId,
                            type: SocketMessageType.response,
                            content: {
                                content,
                                developerMsg
                            }
                        });
                    });
                    return;
                }
            }
            next();
        };
    }
}
