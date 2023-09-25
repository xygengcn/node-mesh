import { EventEmitter } from '@/emitter';
import CustomError, { CustomErrorCode } from '@/error';
import { container, injectable } from '@/inversify/container';
import { CONSTANT_KEY } from '@/inversify/inversify.config';
import { SocketStatus } from '@/lib/socket';
import BindMiddleware from '@/middlwares/bind.middleware';
import RequestMiddleware from '@/middlwares/request.middleware';
import SubscribeMiddleware from '@/middlwares/subscribe.middleware';
import { Callback, Constructor, NotFunction } from '@/typings';
import { isClass, isFunction, isString } from '@/utils';
import { consoleLog } from '@/utils/log';
import { IMessage, INotifictionMessage, Message, MessageSource, MessageSysAction, MessageType } from '../message';
import { MiddlewareClass, MiddlewareFunction } from '../middleware';
import Responder from '../responder';
import { IHandler } from '../responder/handler';
import Socket from '../socket';
import { IHeartbeatOptions, Transport } from '../transport';
import NotificationMiddleware from '@/middlwares/notification.middleware';

/**
 * 配置
 */
export interface IClientOptions {
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
    // 重连
    retryDelay?: number;
    // 5分钟心跳
    heartbeat?: number;
}

/**
 * 客户端事件
 */
export type IClientEvent = {
    // 建立连接
    connect: () => void;

    // 客户端上线
    online: () => void;

    // 客户端下线
    offline: () => void;

    // 重新连接
    reconnect: () => void;

    // 收到订阅消息
    subscribe: (action: string, ...args: any[]) => void;

    // 错误事件
    error: (e: Error) => void;

    // 通知消息
    notification: (message: Message<INotifictionMessage>) => void;

    // 来消息了
    message: (message: Message) => void;

    // 发消息
    send: (messages: IMessage[]) => void;

    // 来自客户端心跳
    heartbeat: (options: IHeartbeatOptions) => void;
};

/**
 * 客户端
 */
@injectable()
export default class Client extends EventEmitter<IClientEvent> {
    /**
     * 配置
     */
    public readonly options: IClientOptions;

    /**
     * socket
     */
    public socket!: Socket;

    /**
     * 通信通道
     */
    public transport!: Transport;

    /**
     * 回答器
     */
    public responder: Responder;

    /**
     * 重连计时器
     */
    public reconnectTimeout: NodeJS.Timeout | null = null;

    /**
     * 初始化
     */
    constructor(options: IClientOptions) {
        super();
        if (typeof options?.port !== 'number') {
            throw Error('端口错误');
        }
        // 配置
        this.options = Object.assign({ logger: true }, options || {}) as IClientOptions;
        // 回答者
        this.responder = new Responder(this.options.namespace);

        // 运输者
        this.transport = new Transport(this.options);

        //日志
        if (this.options.logger) {
            this.$on('emitter:logger', (...args) => {
                consoleLog(this.options.namespace, ...args);
            });
        }
        // 内置中间件,先执行前面的
        this.use(SubscribeMiddleware, NotificationMiddleware, RequestMiddleware, BindMiddleware);
    }

    /**
     * 重新设置配置
     *
     * @param options
     */
    public configure(options: Partial<Pick<IClientOptions, 'auth'>>): IClientOptions {
        if (options) {
            Object.assign(this.options, options || {});
        }
        return this.options;
    }

    /**
     * 请求消息
     *
     * @param action
     * @param params
     */
    public async request(action: string, params: Array<NotFunction<any>>, callback: Callback) {
        // 日志
        this.$debug('[request]', '发起请求：', action);
        if (!action || typeof action !== 'string') {
            callback?.(new CustomError(CustomErrorCode.requestParamsError), null);
            return;
        }

        // 本地有注册动作
        if (this.responder.hasHandler(action)) {
            const handler = this.responder.requestHandler(action);
            if (isFunction(handler.callback)) {
                const { body, error } = await this.responder.callback(handler.callback, params);
                callback(error, body);
                return;
            }
        }

        // 本地没有，请求服务端
        this.transport.request(Message.createRequestMessage(action, ...params), callback);
        return;
    }

    /**
     * 注册方法
     * @param action
     * @param callback
     */
    public response(action: string, callback: IHandler) {
        if (!isString(action)) {
            return;
        }
        this.responder.createHandler(action, callback);
        // 如果上线了再通知服务端
        if (this.socket?.status === SocketStatus.online) {
            this.register();
        }
    }

    /**
     * 发布
     * @param action
     * @param args
     */
    public publish(action: string, ...args: any[]) {
        if (!isString(action)) return;
        this.$debug('[publish]', action);
        this.transport.subscriber.pub(action, ...args);
        // 发送订阅消息到服务端
        this.transport.send(Message.createPublishMessage(action, ...args));
    }

    /**
     * 订阅者
     * @param action
     * @param callback
     */
    public subscribe(action: string, callback: IHandler<void>) {
        if (!isString(action) || !isFunction(callback)) return;
        this.$debug('[subscribe]', action);
        if (isString(action) && isFunction(callback)) {
            this.transport.subscriber.sub(action, callback);
        }
        // 如果上线了再通知服务端
        if (this.socket?.status === SocketStatus.online) {
            this.register();
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
        this.transport.subscriber.unsub(action);
    }

    /**
     * 广播能力
     *
     * 只能广播通知消息
     */
    public broadcast(action: string, content: any) {
        this.$debug('[broadcast]', action, content);
        const message = Message.createNotificationMessage(action, content);
        this.transport.send(message);
    }

    /**
     * 注册中间件
     *
     * 后插入的执行
     *
     * @param middlewares
     */
    public use(...middlewareList: Array<Constructor | MiddlewareFunction>) {
        middlewareList.forEach((middleware) => {
            this.$debug('[middlware]', middleware?.name);
            if (isClass(middleware)) {
                // 每次都是新的
                const middlewareInstance = container.get<MiddlewareClass>(middleware);
                Reflect.defineMetadata(CONSTANT_KEY.MIDDLEWARE_CLIENT, this, middlewareInstance);
                // 注入中间件
                this.transport.use(middlewareInstance);
                return;
            }
            if (isFunction(middleware)) {
                // 注入中间件
                this.transport.use(middleware);
            }
        });
        return this;
    }

    /**
     * 建立客户端
     */
    public createSocket() {
        // 正在请求

        this.$debug('[create]');

        // 初始
        this.socket = new Socket();

        // 绑定名字
        this.socket.bindName(this.options.namespace);

        // 来消息了
        this.socket.$on('message', (message) => {
            this.$info('[message]', message.id, message.action);
            this.$emit('message', message);
        });

        // 发消息
        this.socket.$on('send', (messages) => {
            this.$info('[send]', messages);
            this.$emit('send', messages);
        });

        // 链接事件
        this.socket.$once('connect', () => {
            // 日志
            this.$debug('[connect]', this.socket.localId());
            // 清除重新连接计数器
            this.clearReconnectTimeout();
            // 修改状态
            this.socket.updateStatus(SocketStatus.connected);

            // 触发事件
            this.$emit('connect');

            // 创建消息
            const message = new Message();
            message.setSource(MessageSource.system);
            message.setType(MessageType.callback);
            message.setAction(MessageSysAction.connected);
            this.socket.$emit('message', message);
        });

        /**
         * close 事件：
         * 执行顺序：在 Socket 完全关闭时触发，表示连接已经彻底关闭。
         * 触发条件：Socket 关闭的条件可以是以下几种情况之一：
         * 1、通过调用 socket.end() 或 socket.destroy() 主动关闭连接。
         * 2、接收到远程服务器发送的关闭连接请求。
         * 3、发生了错误，导致连接异常关闭。
         */
        this.socket.$once('close', (hadError) => {
            this.$warn('[close]', hadError);
            // 下线
            this.disconnect(hadError);
        });

        /**
         * 对方发送了关闭数据包过来的事件
         *
         * 1、手动断开服务端进程，客户端会触发  不会触发close
         * 2、服务端end，客户端会触发
         * 3、客户端end，服务端会触发 客户端不会触发
         * 4、手动断开客户端进程，服务端会触发
         *
         * 自己disconnect不会触发
         */
        this.socket.$once('end', () => {
            this.$warn('[end]');
            // 收到服务端断开
            this.disconnect(true);
        });

        this.socket.$on('offline', () => {
            this.$warn('[offline]');
            this.$emit('offline');
        });

        // 上线了
        this.socket.$on('online', () => {
            this.socket.updateStatus(SocketStatus.online);
            // 日志
            this.$success('[online]');
            this.$emit('online');

            // 触发心跳
            this.heartbeat();
        });

        // 有错误发生调用的事件
        this.socket.$on('error', (e: Error) => {
            // 日志
            this.$error('[error]', e);
            this.$emit('error', e);
        });

        // 创建transport
        this.transport.createSender(this.socket);
    }

    /**
     * 客户端心跳
     */
    public heartbeat() {
        // 开始心跳
        this.transport.heartbeat(
            {
                id: this.socket.remoteId(),
                name: this.options.namespace,
                memory: process.memoryUsage(),
                responderEvents: this.responder.toHandlerEvents(),
                subscribeEvents: this.transport.subscriber.toSubscribeEvents()
            },
            (error, content) => {
                if (error) {
                    this.$error('[heartbeat]', error);
                    this.$emit('error', error);
                } else {
                    this.$success('[heartbeat]', content);
                    this.$emit('heartbeat', content);
                    this.heartbeat();
                }
            }
        );
    }

    /**
     * 建立连接
     */
    public connect(): this {
        // 在线不需要连接
        if (this.socket?.status === SocketStatus.online) {
            return this;
        }

        // 正在请求
        this.socket.updateStatus(SocketStatus.pending);

        // 开始链接
        this.socket.connect({ port: this.options.port, host: this.options.host || '127.0.0.1', family: 4 });

        return this;
    }

    /**
     * 注册数据到服务端
     *
     * 请求方法或者订阅方法
     */
    public register() {
        // keys
        const responderEvents = this.responder.toHandlerEvents();

        // 订阅
        const subscribeEvents = this.transport.subscriber.toEventNames();

        this.$debug('[register]', responderEvents, subscribeEvents);

        const message = Message.createNotificationMessage(MessageSysAction.register, responderEvents, subscribeEvents);
        message.setSource(MessageSource.system);

        return this.transport.send(message);
    }

    /**
     * 重新连接
     */
    public reconnect() {
        if (this.socket?.status === SocketStatus.offline && !this.reconnectTimeout) {
            this.socket.updateStatus(SocketStatus.retrying);
            // 清除socket
            this.socket?.unref();
            this.socket?.removeAllListeners();
            // 500ms开始链接
            this.reconnectTimeout = setTimeout(() => {
                this.$debug('[reconnect]');
                this.$emit('reconnect');
                this.clearReconnectTimeout();
                this.createSocket();
                this.connect();
            }, this.options.retryDelay || 3000);
        }
    }

    /**
     * 清理重连定时器
     */
    private clearReconnectTimeout() {
        this.$debug('[clearReconnetTimeout]');
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    /**
     * 断开链接
     *
     * server.end() 方法用于优雅地关闭服务器，让所有连接有机会完成它们的操作，而 server.destroy() 方法用于强制关闭服务器，可能导致未处理的数据丢失。
     */
    public disconnect(reconnect: boolean = false) {
        this.$warn('[disconnect]', reconnect);
        this.clearReconnectTimeout();
        // 结束连接
        return this.transport?.$destroy().then(() => {
            this.$debug('[ended]');
            // 已经下线了就不会再触发
            if (this.socket?.status !== SocketStatus.offline) {
                this.$emit('offline');
            }
            // 重新连接
            if (reconnect) {
                this.reconnect();
            }
        });
    }
}
