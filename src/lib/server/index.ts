import { EventEmitter } from '@/emitter';
import { Callback, Constructor, NotFunction } from '@/typings';
import net, { AddressInfo } from 'net';
import Socket, { SocketStatus } from '../socket';
import { IHeartbeatOptions, Transport } from '../transport';
import { MiddlewareClass, MiddlewareFunction } from '../middleware';
import { container, injectable } from '@/inversify/container';
import { CONSTANT_KEY } from '@/inversify/inversify.config';
import Responder from '../responder';
import CustomError, { CustomErrorCode } from '@/error';
import { IHandler } from '../responder/handler';
import ConnectionManager from './connection-manager';
import { IMessage, INotifictionMessage, Message } from '../message';
import { consoleLog } from '@/utils/log';
import { isClass, isFunction, isString } from '@/utils';
import AuthMiddleware from '@/middlwares/auth.middleware';
import RequestMiddleware from '@/middlwares/request.middleware';
import Subscriber from '../subscriber';
import RegisterMiddleware from '@/middlwares/register.middleware';
import SubscribeMiddleware from '@/middlwares/subscribe.middleware';
import NotificationMiddleware from '@/middlwares/notification.middleware';
import HearbeatMiddleware from '@/middlwares/heartbeat.middleware';
import Connection from './connection-manager/connection';

/**
 * 配置
 */
export interface IServerOptions {
    // 名字
    namespace: string;
    // 端口
    port: number;
    // 域名ip
    host?: string;
    // 鉴权
    auth?: any;
    // 日志
    logger?: boolean;
    // 请求超时
    timeout?: number;
    // 5分钟心跳
    heartbeat?: number;
}

/**
 * 服务端状态
 */
export enum ServerStatus {
    none = 'none', // 默认状态
    pending = 'pending', // 等待链接
    online = 'online', // 在线
    offline = 'offline' // 在线
}

/**
 * 服务端事件
 */
export type IServerEvent = {
    // 建立连接
    connect: () => void;

    // 服务端上线
    online: () => void;

    // 服务端下线
    offline: () => void;

    // 错误事件
    error: (e: Error) => void;

    // 收到订阅消息
    subscribe: (action: string, ...args: any[]) => void;

    // 来消息了
    message: (message: Message) => void;

    // 发消息
    send: (messages: IMessage[]) => void;

    // 收到客户端连接
    clientConnect: (connection: Connection) => void;

    // 客户端在线
    clientOnline: (connection: Connection) => void;

    // 客户端下线
    clientOffline: (connection: Connection) => void;

    // 通知消息
    notification: (message: Message<INotifictionMessage>) => void;

    // 来自客户端心跳
    heartbeat: (options: IHeartbeatOptions) => void;
};
/**
 * 服务端
 */

@injectable()
export default class Server extends EventEmitter<IServerEvent> {
    /**
     * 配置
     */
    public options: IServerOptions;

    /**
     * 服务端状态
     */
    public status: ServerStatus = ServerStatus.none;

    // 链接对象
    public server!: net.Server;

    // 客户端
    public connectionManager: ConnectionManager = new ConnectionManager();

    // 回答者
    public responder: Responder;

    /**
     * 订阅者
     */
    public subscriber: Subscriber;

    // 中间件
    private middlewareManager: MiddlewareClass[] = [];

    /**
     * 初始化
     */
    constructor(options: IServerOptions) {
        super();
        if (typeof options?.port !== 'number') {
            throw Error('端口错误');
        }

        // 配置
        this.options = Object.assign({ logger: true }, options || {}) as IServerOptions;

        // 回答者
        this.responder = new Responder(this.options.namespace);

        // 订阅
        this.subscriber = new Subscriber();

        // 日志
        //日志
        if (this.options.logger) {
            this.$on('emitter:logger', (...args) => {
                consoleLog(this.options.namespace, ...args);
            });
        }
        // 内置中间件,先执行前面的
        this.use(SubscribeMiddleware, NotificationMiddleware, RegisterMiddleware, RequestMiddleware, HearbeatMiddleware, AuthMiddleware);
    }

    /**
     * 重新设置配置
     *
     * @param options
     */
    public configure(options: Partial<Pick<IServerOptions, 'auth'>>): IServerOptions {
        if (options) {
            Object.assign(this.options, options || {});
        }
        return this.options;
    }
    /**
     * 建立服务器
     */
    public createSocket() {
        // 没有端口
        if (!this.options.port) {
            throw Error('端口错误');
        }

        this.$debug('[create]');
        // 准备建立连接
        this.status = ServerStatus.pending;

        // 创建服务器
        this.server = net.createServer({ keepAlive: true }, (netSocket: net.Socket) => {
            let socket = new Socket();
            // 合并socket
            socket.assign(netSocket);

            let remoteId = socket.remoteId();
            this.$debug('[connecting]', remoteId);

            // 设置绑定状态
            socket.setBindTimeout();

            // 修改状态
            socket.updateStatus(SocketStatus.binding);
            // 来消息了
            socket.$on('message', (message) => {
                this.$info('[message]', message.id, message.action);
                this.$emit('message', message);
            });

            // 发消息
            socket.$on('send', (message) => {
                this.$info('[send]', message);
                this.$emit('send', message);
            });

            // 上线了
            socket.$on('online', () => {
                socket.updateStatus(SocketStatus.online);
                socket.clearBindSetTimeout();
                this.$success('[client-online]', remoteId);
                const connecttion = this.connectionManager.findConnectionById(remoteId);
                this.$emit('clientOnline', connecttion);

                // 日志
                this.getConnections().then((result) => {
                    this.$debug('[connections]', `连接数 ${result}  客户端数 ${this.connectionManager.count}`);
                });
            });

            // 下线了
            socket.$on('offline', () => {
                this.$warn('[client-offline]', remoteId, socket.status);
                const connecttion = this.connectionManager.findConnectionById(remoteId);
                this.$emit('clientOffline', connecttion);
            });

            /**
             * 关闭
             *
             * 1、客户端自己断开不会回调，服务端自助断开会触发
             */
            socket.$once('close', () => {
                this.$warn('[client-close]', socket.remoteId());
                // 清理客户端所有数据
                this.offline(remoteId);
                remoteId = null;
                socket = null;
            });

            /**
             *
             * 结束
             * 1、客户端自己断开会回调，服务端自助断开会触发
             */
            socket.$once('end', () => {
                socket.clearBindSetTimeout();
                this.$warn('[client-end]', socket.remoteId());
                setImmediate(() => {
                    socket.$end();
                });
            });

            // 错误
            socket.$on('error', (error) => {
                this.$error('[client-error]', error);
                this.$emit('error', error);
                socket.clearBindSetTimeout();
            });

            // 创建transport
            const transport = new Transport(this.options);

            // 创建发送者
            transport.createSender(socket);
            // 注入中间件
            transport.use(...this.middlewareManager);

            // 存储客户端
            const connection = this.connectionManager.createConnection(socket, transport);

            // 回调
            this.$emit('clientConnect', connection);
        });

        //设置监听时的回调函数
        this.server.on('listening', () => {
            this.status = ServerStatus.online;
            this.$success('[listening]', this.localId());
            this.$emit('online');
        });

        //设置关闭时的回调函数
        this.server.on('close', () => {
            this.server.unref();
            this.server.removeAllListeners();
            this.status = ServerStatus.offline;
            this.$debug('[close]');
            this.$emit('offline');
        });

        //设置出错时的回调函数
        this.server.on('error', (e) => {
            this.$error('[error]', e);
            this.$emit('error', e);
        });
    }

    /**
     * 发布
     * @param action
     * @param args
     */
    public publish(action: string, ...args: any[]) {
        if (isString(action)) {
            this.$debug('[publish]', action);
            // 通知自己的事件
            this.subscriber.pub(action, ...args);

            // 通知订阅的客户端
            const connectionIds = this.connectionManager.findConnectionIdsBySubscribe(action);
            const message = Message.createPublishMessage(action, ...args);
            this.connectionManager.broadcast(message, connectionIds);
        }

        return;
    }

    /**
     * 广播能力
     *
     * 只能广播通知消息
     */
    public broadcast(action: string, content: any) {
        this.$debug('[broadcast]', action, content);
        const message = Message.createNotificationMessage(action, content);
        this.connectionManager.broadcast(message);
    }

    /**
     * 订阅者
     * @param action
     * @param callback
     */
    public subscribe(action: string, callback: IHandler<void>) {
        if (isString(action) && isFunction(callback)) {
            this.$debug('[subscribe]', action);
            this.subscriber.sub(action, callback);
        }
        return;
    }

    /**
     * 取消订阅
     * @param action
     * @returns
     */
    public unsubscribe(action: string) {
        if (!isString(action)) return;
        this.$debug('[subscribe]', action);
        this.subscriber.unsub(action);
    }

    /**
     * 注册中间件
     *
     * 需要在这里标记是服务端
     *
     * @param middlewares
     */
    public use(...middlewareList: Array<Constructor | MiddlewareFunction>) {
        middlewareList.forEach((middleware) => {
            this.$debug('[middlware]', middleware.name);
            if (isClass(middleware)) {
                const middlewareInstance = container.get<MiddlewareClass>(middleware);
                Reflect.defineMetadata(CONSTANT_KEY.MIDDLEWARE_SERVER, this, middlewareInstance);
                this.middlewareManager.push(middlewareInstance);
                return;
            }
            if (isFunction(middleware)) {
                this.middlewareManager.push(middleware);
            }
        });
        return this;
    }

    /**
     * 请求消息
     *
     * @todo 如何请求客户端
     *
     * @param action
     * @param params
     */
    public async request<T = any, K = any>(action: T, params: Array<NotFunction<K>>, callback: Callback) {
        // 日志
        this.$debug('[request]', '发起请求：', action);
        if (!action || typeof action !== 'string') {
            return callback(new CustomError(CustomErrorCode.requestParamsError), null);
        }

        // 本地有注册动作
        if (this.responder.hasHandler(action)) {
            const handler = this.responder.requestHandler(action);
            if (isFunction(handler.callback)) {
                const { body, error } = await this.responder.callback(handler.callback, params);
                callback?.(error, body);
                return;
            }

            // 发消息
            if (isString(handler.remoteId)) {
                const connection = this.connectionManager.findConnectionById(handler.remoteId);
                if (connection?.status === 'online') {
                    connection.transport.request(Message.createRequestMessage(action, ...params), callback);
                    return;
                }
                this.$debug('[request]', Error(`不在线或者不存在socket`));
                callback(new CustomError(CustomErrorCode.actionSocketNotActive), '不在线或者不存在socket');
                return;
            }
        }
        this.$debug('[request]', Error(`动作不存在：${action}`));
        // 本地没有请求客户端
        callback(new CustomError(CustomErrorCode.actionNotExist), null);
    }

    /**
     * 注册方法
     * @param action
     * @param callback
     */
    public response(action: string, callback: IHandler) {
        this.responder.createHandler(action, callback);
    }

    /**
     * 建立链接
     */
    public connect() {
        this.$emit('connect');
        this.$debug('[connect]');
        this.server.listen({ port: this.options.port, keepAlive: true, keepAliveInitialDelay: 0, host: '0.0.0.0' });
    }

    /**
     * 获取连接数
     * @returns
     */
    public getConnections(): Promise<number> {
        return new Promise((resolve) => {
            this.server.getConnections((error, count) => {
                if (error) {
                    this.$error('[getConnections]', error);
                    this.$emit('error', error);
                    resolve(0);
                    return;
                }
                resolve(count);
            });
        });
    }
    /**
     * 下线客户端
     * @param remoteId
     */
    public offline(remoteId: string) {
        if (isString(remoteId)) {
            this.responder.removeHandler(remoteId);
            this.connectionManager.offline(remoteId);
        }
    }

    /**
     * 停止运行
     */
    public async disconnect() {
        this.$debug('[disconnect]');
        this.status = ServerStatus.offline;
        // 停止后把所有的客户端断开
        this.connectionManager.end();
        // 清除所有监听
        this.server.removeAllListeners();
        this.server.close();
        this.server.unref();
        this.$emit('offline');
    }

    /**
     * 本地地址
     * @returns
     */
    public localId(): string {
        if (!this.server) return '';
        const addressInfo = this.server.address() as AddressInfo;
        if (!addressInfo) return '';
        return `${addressInfo.family || 'IPV4'}://${addressInfo.address}:${addressInfo.port}`;
    }

    /**
     * 绑定客户端事件
     * @param connectionId
     * @param responderEvents
     * @param subscribeEvents
     */
    public bindConnectionEvents(connectionId: string, responderEvents: string[], subscribeEvents: string[]) {
        // 请求
        if (Array.isArray(responderEvents)) {
            responderEvents?.forEach((key) => {
                this.responder.createHandler(key, connectionId);
            });
        }
        // 订阅
        if (Array.isArray(subscribeEvents)) {
            const connection = this.connectionManager.findConnectionById(connectionId);
            subscribeEvents?.forEach((key) => {
                // 客户端绑定
                connection.transport.subscriber.sub(key);
                // 绑定客户客户端
                this.connectionManager.bindSubscribe(key, connectionId);
            });
        }
    }
}
