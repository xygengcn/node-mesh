import serverBindMiddleware from '@/middlewares/server-bind';
import { SocketType } from '@/typings/enum';
import { SocketMessage, SocketMessageType, SocketSysEvent } from '@/typings/message';
import { ClientMiddleware, ServerSocketEvent, ServerSocketOptions, SocketResponseAction } from '@/typings/socket';
import { uuid } from '@/utils';
import net, { Server, Socket } from 'net';
import Context from '../context';
import Emitter from '../emitter';
import BaseError from '../error';
import ClientSocket from './client';

/**
 * 服务端状态
 */
export type ServerSocketStatus = 'stop' | 'running' | 'waiting' | 'pending';

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
    private server!: Server;

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
        const namespace = `Server_${options.serverId}`;
        super(namespace);
        this.options = Object.assign(this.options, options || {});
        this.status = 'waiting';
        this.createServer();
    }

    /**
     * 停止
     */
    public async stop() {
        const count = await this.getConnections();
        this.log('[stop]', '目前连接数', count);
        this.server.close();
        this.status = 'stop';
        // 停止后把所有的客户端断开
        this.onlineClients.forEach((c) => {
            c.client.disconnect();
            c.client.off();
            this.handleClientRemove(c.client.targetId);
        });
        this.connectClients.forEach((client) => {
            client.disconnect();
            client.off();
            this.handleClientRemove(client.targetId);
        });
    }

    /**
     * 重启
     */
    public restart() {
        this.log('[restart]');
        this.server.ref();
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
            return Promise.reject(new BaseError(30001, 'Action is required'));
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
        return Promise.reject(new BaseError(30005, 'Request is not exist'));
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
        this.log('[start]', '服务端启动');
        this.status = 'pending';
        this.server.listen(this.options.port);
    }

    /**
     * 建立服务器
     */
    private createServer() {
        // 没有端口
        if (!this.options.port) {
            this.emit('error', new BaseError(30010, 'port为空'));
        }

        // 创建服务器
        this.server = net.createServer({ keepAlive: true }, this.handleClientConnect.bind(this));

        //设置监听时的回调函数
        this.server.on('listening', () => {
            this.success('[listening]', '服务端上线');
            this.status = 'running';
            this.emit('listening', this.server);
            this.emit('online', this.server);
        });

        //设置关闭时的回调函数
        this.server.on('close', () => {
            this.log('[close]');
            this.server.unref();
            this.server.removeAllListeners();
            this.status = 'stop';
            this.emit('close', this.server);
        });

        //设置出错时的回调函数
        this.server.on('error', (e) => {
            this.logError('[error]', e);
            this.status = 'stop';
            this.emit('error', e);
        });
    }

    /**
     * 获取连接数
     * @returns
     */
    private getConnections(): Promise<number> {
        return new Promise((resolve) => {
            this.server.getConnections((error, count) => {
                if (error) {
                    this.logError('[getConnections]', error);
                    this.emit('error', error);
                    return;
                }
                this.debug('[getConnections]', count);
                resolve(count);
            });
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
                    callback(new BaseError(30006, 'Server is not running'), null);
                    return;
                }
                // 有此客户端
                const socket = this.onlineClients.get(responseAction.socketId);

                // 客户端不在线
                if (socket?.client.status !== 'online') {
                    callback(new BaseError(30007, 'Action is not active'), null);
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
        callback(new BaseError(30001, 'Action is not exist'), null);
    }

    /**
     * 处理客户端事件
     * @param socket Socket
     */

    private handleClientConnect(socket: Socket) {
        // 临时id，绑定成功就会被移除
        const tempSocketId = `temp-${this.options.serverId}-${uuid()}`;

        this.log('[client-connnect]', '监听到客户端', 'address: ', socket.address(), 'localAddress: ', socket.localAddress, '临时id: ', tempSocketId);

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

        // 收到end
        client.on('end', () => {
            this.debug('[client-end]', client.targetId);
        });

        client.on('close', () => {
            this.debug('[client-close]', client.targetId);
        });

        // 离线通知
        client.on('disconnect', () => {
            this.debug('[client-disconnect]', client.targetId);
            client.off();
            this.handleClientRemove(client.targetId);
        });

        // 下线通知
        client.on('offline', () => {
            this.debug('[client-offline]', client.targetId);
            // 自己发出客户端下线通知
            this.emit('sysMessage', { clientId: client.targetId, serverId: this.options.serverId, event: SocketSysEvent.socketoffline });
        });

        // 处理消息
        client.on('message', (msg) => {
            this.log('[client-message]', '服务端收到数据: ', msg?.msgId, 'action:', msg?.action);
            this.emit('message', msg, client);
        });
    }

    /**
     * 移除客户端
     *
     * @todo 通知其他客户端
     *
     * @param clientId
     */
    private handleClientRemove(clientId: string) {
        const socketId = `${this.options.serverId}-${clientId}`;
        // 移除客户端
        this.connectClients.delete(socketId);
        this.onlineClients.delete(socketId);
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
