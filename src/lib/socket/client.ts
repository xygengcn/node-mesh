import { clientSocketBindMiddleware } from '@/middlewares/client-bind';
import { clientMessageMiddleware } from '@/middlewares/client-message';
import clientSysMsgMiddleware from '@/middlewares/client-sys';
import { NotFunction } from '@/typings';
import { SocketBroadcastMsg, SocketBroadcastMsgContent, SocketMessage, SocketMessageType, SocketSysEvent, SocketSysMsgSubscribeContent } from '@/typings/message';
import { ClientMiddleware, ClientSocketEvent, ClientSocketOptions, ClientSocketStatus, SocketCallback, SocketResponseAction, SocketType } from '@/typings/socket';
import { compose, msgUUID, parseMessage, stringifyError } from '@/utils';
import { Stream } from 'amp';
import Message from 'amp-message';
import { Socket, AddressInfo } from 'net';
import Context from '../context';
import Emitter from '../emitter';
import BaseError from '../error';

/**
 * 客户端
 *
 */
export default class ClientSocket extends Emitter<ClientSocketEvent> {
    // 状态
    public status: ClientSocketStatus = 'none';

    // 对象
    public socket!: Socket;

    /**
     * 目标id
     */
    public get targetId() {
        return this.options?.targetId || '';
    }

    /**
     * 客户端id
     */
    public get clientId() {
        return this.options?.clientId || '';
    }

    /**
     * 是不是服务端的客户端
     */
    public get isServer(): boolean {
        return this.options.type === SocketType.server;
    }

    // 记录订阅的key
    private subscriptions: Set<string> = new Set();

    // 配置
    private options: ClientSocketOptions = { retry: true, host: '0.0.0.0', port: 31000, type: SocketType.client, clientId: 'Client', targetId: 'Server' };

    // 重连配置
    private retryTimeout: NodeJS.Timer | null = null;

    // 心跳机制
    private heartbeatInterval: NodeJS.Timer | null = null;

    // 手动关闭
    private isManualClose = false;

    // 记录每次请求
    private clientRequestTimeoutMap: Map<string, NodeJS.Timer> = new Map();

    // 记录response的函数
    private responseAction: Map<string, SocketResponseAction> = new Map();

    // 中间件
    private middlewares: Map<string, { middlewares: ClientMiddleware[]; plugin: (_this: Context) => Promise<void> }> = new Map();

    // 消息缓存
    private messageCacheQueue: Array<SocketMessage> = [];

    // 构造
    constructor(options: ClientSocketOptions, socket?: Socket) {
        const namespace = `Socket-${options.type || SocketType.client}_${options.type ? options.targetId : options.clientId}`;
        super(namespace, options.debug);
        // 配置初始化
        this.configure(options);

        // 初始化
        if (socket && socket instanceof Socket) {
            this.socket = socket;
            this.status = 'binding';
            this.initSocketEvent();
        } else {
            this.status = 'none';
            // 创建Socket
            this.socket = new Socket();
        }

        // 绑定中间件
        this.use('connect', clientSocketBindMiddleware(this.options.secret));

        // 处理系统消息
        this.use('data', clientSysMsgMiddleware(this));

        // 处理消息
        this.use('data', clientMessageMiddleware());
    }

    /**
     * 插件
     *
     * 后注册先执行
     *
     * @param hook string
     * @param middleware ClientMiddleware
     */
    public use(hook: 'data' | 'connect', middleware: ClientMiddleware) {
        if (typeof middleware !== 'function') throw new TypeError('middleware must be a function!');
        const hookMiddleware = this.middlewares.get(hook);
        const middlewares: ClientMiddleware[] = hookMiddleware?.middlewares || [];
        middlewares.unshift(middleware);
        const plugin = compose(middlewares);
        this.middlewares.set(hook, { middlewares, plugin });
    }

    /**
     * 重新设置配置
     *
     * @param options
     */
    public configure(options: Partial<Pick<ClientSocketOptions, 'targetId' | 'timeout' | 'retryDelay'>>): ClientSocketOptions {
        if (options) {
            Object.assign(this.options, options || {});
        }
        return this.options;
    }

    /**
     * 客户端链接
     */
    public connect(options?: Partial<ClientSocketOptions>) {
        // 更新配置
        if (options && typeof options === 'object') {
            Object.assign(this.options, options);
        }

        if (!this.options.port) {
            this.emit('error', new BaseError(30010, 'port为空'));
        }

        // 在线不需要连接
        if (this.status === 'online') {
            return;
        }

        this.debug('[create-connect]', '创建连接', this.options);

        this.status = 'pending';

        // 开始链接
        this.socket.connect({ port: this.options.port, host: this.options.host, family: 4 });

        // 链接事件
        this.socket.once('connect', () => {
            this.debug('[connect]', '连接到服务端，socketId', this.getSocketId());
            // 解除手动限制，手动断开后手动连接后的自动重连
            this.isManualClose = false;

            // 使用插件
            this.useHook('connect', this.socket);

            // 连接成功，删掉重连定时
            this.clearRetryTimeout();
        });

        // 绑定事件
        this.initSocketEvent();
    }

    /**
     * 重连
     */
    public reconnect(options?: Partial<ClientSocketOptions>): void {
        // 更新配置
        if (options && typeof options === 'object') {
            this.configure(options);
        }
        this.debug('[reconnect]', '准备重连', 'status:', this.status, 'isManualClose:', this.isManualClose);
        if (this.status === 'error' || this.status === 'offline') {
            // 回调
            this.emit('reconnect', this.socket);

            // 移除上一次
            this.socket?.unref();
            this.socket?.removeAllListeners();

            // 修改状态
            this.status = 'retrying';

            // 500ms开始链接
            setTimeout(() => {
                this.connect();
            }, 500);
        }
    }

    /**
     * 请求消息
     *
     * 俗称约定：action为socket:*为隐藏指令
     *
     *
     * @param action
     * @param params
     */
    public request<T = any, K = any>(action: string, ...params: Array<NotFunction<K>>): Promise<T> {
        // 日志
        this.log('[request-send]', '客户端请求，action:', action);

        if (!action || typeof action !== 'string') {
            return Promise.reject(new BaseError(30001, 'Action is required'));
        }

        // 先检测本地是否注册

        if (this.responseAction.has(action)) {
            const responseAction: SocketResponseAction = this.getResponse(action) as SocketResponseAction;
            return new Promise(async (resolve, reject) => {
                try {
                    const result = await responseAction.apply(undefined, params || []);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        }

        // 请求服务端
        if (this.socket) {
            return new Promise((resolve, reject) => {
                this.requestMessage(action, params, (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
            });
        }

        // 错误处理
        this.logError('[request]', new BaseError(30002, '客户端请求失败', { action, params, status: this.status }));

        // 返回失败
        this.emit('error', new BaseError(30002, "Socket isn't connect !"));
        return Promise.reject(new BaseError(30002, "Socket isn't connect !"));
    }

    /**
     * 回答事件
     * @param action
     * @param callback
     */
    public response(action: string, callback: SocketResponseAction) {
        if (typeof action === 'string' && typeof callback === 'function') {
            this.responseAction.set(action, callback);
            return;
        }
        throw TypeError('Action is a string type and callback is a function');
    }

    /**
     * 广播
     * @param content
     */
    public broadcast<T extends SocketBroadcastMsgContent = SocketBroadcastMsgContent>(action: string | SocketSysEvent, content: T) {
        const msgId = this.send<SocketBroadcastMsg>({
            action: action || SocketSysEvent.socketNotification,
            type: SocketMessageType.broadcast,
            content: {
                content
            }
        });
        this.debug('[broadcast-send]', msgId);
        return msgId;
    }

    /**
     * 发布消息
     * @param action
     * @param content
     */
    public publish<T = any>(action: string, content: T, developerMsg?: Error | undefined) {
        const msgId = this.send({
            action,
            type: SocketMessageType.subscribe,
            content: {
                content,
                developerMsg
            }
        });
        // 发给自己
        if (this.subscriptions.has(action)) {
            this.emit(`subscribe:${action}`, developerMsg, content);
            this.emit('subscribe', { action, content: { content, developerMsg }, type: SocketMessageType.subscribe, msgId, fromId: this.clientId });
        }
        this.debug('[client-publish]', msgId);
    }

    /**
     * 订阅消息
     *
     * sub:{action}s
     *
     * @param action
     * @param cb
     */
    public subscribe(action: string, cb?: SocketCallback) {
        this.log('[subscribe]', action);
        // 已经是在线，需要通知服务端
        if (this.status === 'online') {
            this.broadcast<SocketSysMsgSubscribeContent>(SocketSysEvent.socketNotification, {
                event: SocketSysEvent.socketSub,
                content: { action, subscribe: true, socketId: this.getSocketId() }
            });
        }

        this.subscriptions.add(action);
        typeof cb === 'function' && this.on(`subscribe:${action}`, cb);
    }

    /**
     * 取消订阅
     *
     * sub:{action}
     * @param action
     * @returns
     */
    public unsubscribe(action: string, cb?: SocketCallback) {
        this.log('[unsubscribe]', action);
        if (cb) {
            this.off(`subscribe:${action}`, cb);
        } else {
            this.off(`subscribe:${action}`);
        }
        const listenCount = this.listenerCount(`subscribe:${action}`);
        if (listenCount === 0) {
            // 已经是在线，需要通知服务端
            if (this.status === 'online') {
                this.broadcast<SocketSysMsgSubscribeContent>(SocketSysEvent.socketNotification, {
                    event: SocketSysEvent.socketSub,
                    content: { action, subscribe: false, socketId: this.getSocketId() }
                });
            }
            this.subscriptions.delete(action);
        }
    }

    /**
     * 获取socketId
     * @returns
     */
    public getSocketId(): string {
        if (this.options.type === 'server' && this.socket.remotePort) {
            return `${this.socket.remoteFamily || 'IPv4'}://${this.socket.remoteAddress}:${this.socket.remotePort}`;
        }
        const addressInfo = this.socket.address() as AddressInfo;
        if (this.options.type === 'client' && addressInfo.port) {
            return `${addressInfo.family || 'IPv4'}://${addressInfo.address}:${addressInfo.port}`;
        }
        return '';
    }

    /**
     * 断开链接
     */
    public disconnect(error?: Error) {
        if (error) {
            this.logError('[disconnect]', new BaseError(30014, error));
        } else {
            this.debug('[disconnect]', '客户端断开，当前状态：', this.status);
        }
        this.isManualClose = true;
        // 结束连接
        this.socket?.end(() => {
            this.debug('[disconnect-end-callback]');
            // 已经下线了就不会再触发
            if (this.status !== 'offline') {
                this.emit('disconnect', this.socket);
            }
        });
        this.socket?.destroy(error);
    }

    /**
     * 获取注册的动作
     * @param action
     * @returns
     */
    public getResponse(action: string): SocketResponseAction | undefined {
        return this.responseAction.get(action);
    }

    /**
     * 移除注册的动作
     * @param action
     * @returns
     */
    public removeResponse(action: string) {
        return this.responseAction.delete(action);
    }

    /**
     * 返回所有动作的keys
     *
     * 忽略系统方法
     * @returns
     */
    public responseKeys(): string[] {
        const keys = Array.from(this.responseAction.keys());
        return keys.filter((key) => {
            return !/^socket:.+$/i.test(key);
        });
    }

    /**
     * 返回订阅keys
     */
    public subscription(): string[] {
        return Array.from(this.subscriptions.keys());
    }

    /**
     * 是否订阅了
     */
    public isSubscribe(action: string): boolean {
        return this.subscriptions.has(action);
    }

    /**
     * 发送消息
     * @param msg
     * @returns
     */
    public send<T extends SocketMessage = SocketMessage>(msg: Partial<T>): string {
        if (!msg.action) return '';
        // 请求时间
        const requestTime = new Date().getTime();
        // 生成唯一id
        const msgId = msg.msgId || this.msgId(msg.action);

        // 发送内容
        const socketMessage: SocketMessage = {
            action: msg.action,
            type: msg.type || SocketMessageType.request,
            headers: {
                origin: this.getSocketId()
            },
            content: {
                content: msg.content?.content,
                developerMsg: stringifyError(msg.content?.developerMsg) as any
            },
            // 下面的是不能改的
            msgId,
            time: requestTime,
            targetId: this.targetId, // 接收端
            fromId: this.clientId // 发送端
        };
        // 发送
        if (socketMessage.action && socketMessage.targetId) {
            // 只有在线或者系统消息才能直接发出去
            if (this.status === 'online' || /^socket:.+$/i.test(socketMessage.action)) {
                // 插入缓存
                this.debug('[send]', '消息', socketMessage);
                this.emit('send', socketMessage);
                this.write(socketMessage);
            } else {
                // 插入队列
                this.messageCacheQueue.push(socketMessage);
                this.debug('[send-cache]', '消息', socketMessage.msgId);
            }
            return msgId;
        } else {
            // action 和 targetId 是必要的
            this.logError('[send]', new BaseError(30015, '参数错误'));
        }
        return '';
    }

    /**
     * 封装发送消息
     * @param args
     */
    private requestMessage<T = any>(action: string, content: Array<NotFunction<T>>, callback: (error: Error | undefined | null, ...result: any[]) => void) {
        if (this.socket) {
            // 生成唯一id
            const msgId = this.msgId(action);

            // log
            this.log('[request-message]', 'action:', action, '发出消息:', msgId);

            // 存在回调
            if (callback && typeof callback === 'function') {
                // 存在计时器要清理掉
                const clearTimerEvent = () => {
                    if (this.clientRequestTimeoutMap.has(msgId)) {
                        clearTimeout(this.clientRequestTimeoutMap.get(msgId));
                        this.clientRequestTimeoutMap.delete(msgId);
                    }
                };
                // 时间超时
                const timeoutErrorEvent = () => {
                    clearTimerEvent();
                    // 回调错误
                    callback(new BaseError(30003, 'Request Timeout'));
                    this.off(`request:${msgId}`, timeoutErrorEvent);
                };
                // 建立五秒回调限制
                const eventTimeout = setTimeout(timeoutErrorEvent, this.options.timeout || 30000);

                // 保存单次请求计时器
                this.clientRequestTimeoutMap.set(msgId, eventTimeout);

                // 收到回调
                this.once(`request:${msgId}`, (error, ...result) => {
                    clearTimerEvent();
                    // 日志
                    this.log('[request-message-receive]', 'client收到消息回调:', msgId);

                    // 需要处理错误信息
                    callback(error, ...result);
                });
            }

            // 发送
            this.send<SocketMessage<Array<NotFunction<any>>>>({
                content: {
                    content
                },
                action,
                msgId
            });
        }
    }

    /**
     * 消息id生成
     * @returns
     */
    private msgId(action: string): string {
        return msgUUID(`${this.clientId}-${action}`);
    }

    /**
     *
     * 使用插件
     *
     * @param hook
     * @param args
     */
    private useHook<T extends string = keyof ClientSocketEvent>(hook: T, ...args: T extends keyof ClientSocketEvent ? Parameters<ClientSocketEvent[T]> : any[]): Promise<void> {
        this.emit(hook as any, ...(args as any));
        const plugin = this.middlewares.get(hook);
        if (plugin?.plugin) {
            const ctx = new Context(this, args[0], args[1]);
            return plugin.plugin.call(this, ctx);
        }
        return Promise.resolve();
    }

    /**
     * 发送消息队列
     *
     * 1、请求的时候
     *
     * 2、登录后
     * @param args
     */
    private sendMessageQueue(): void {
        if (this.messageCacheQueue.length <= 0) return;
        this.write(...this.messageCacheQueue);
        this.messageCacheQueue = [];
    }

    /**
     * 发送消息队列
     *
     * 1、请求的时候
     *
     * 2、登录后
     * @param args
     */
    private write(...msgs: SocketMessage[]): void {
        if (msgs.length <= 0) return;
        const msgIds = msgs.map((msg) => msg.msgId);
        const message = new Message(msgs);
        this.log('[write]', '开始消息队列', msgIds);
        this.socket.write(message.toBuffer(), (e) => {
            if (e) {
                this.logError('[write]', new BaseError(30004, e));
                this.emit('error', new BaseError(30004, e));
                return;
            }
            this.success('[write]', '消息队列发送成功', msgIds);
        });
    }

    /**
     * 监听事件
     */
    private initSocketEvent() {
        this.debug('[initSocketEvent]', '开始绑定事件');

        // 心跳
        this.handleHeartbeat();

        // 保持活跃
        this.socket.setKeepAlive(true, 500);

        // 接收来自服务端的信息
        const stream = new Stream();
        this.socket.pipe(stream);
        stream.on('data', (buf: Buffer) => {
            const messages = parseMessage(buf);
            messages.forEach((mesage) => {
                this.useHook('data', buf, mesage);
            });
        });

        // 有错误发生调用的事件
        this.socket.on('error', (e: Error & { code: string }) => {
            // 日志
            this.logError('[client-error]', e);
            this.status = 'error';

            this.emit('error', e);

            if (e.code === 'ECONNREFUSED') {
                // 网络问题，重连机制
                this.autoRetryConnect();
            }
        });

        // socket关闭的事件
        this.socket.once('close', (hadError) => {
            this.debug('[close]', 'Error:', hadError);
            // 下线
            this.handleOffline();

            // 回调
            this.emit('close', this.socket);

            this.socket.removeAllListeners();

            // 清理
            this.clearReuqestTimeoutMap();

            // 关闭触发，重连机制
            if (!this.isManualClose) {
                this.autoRetryConnect();
            }
        });

        /**
         * 对方发送了关闭数据包过来的事件
         *
         * 1、手动断开服务端进程，客户端会触发
         * 2、服务端disconnect，客户端会触发
         * 3、客户端disconnect，服务端会触发
         * 4、手动断开客户端进程，服务端会触发
         *
         * 自己disconnect不会触发
         */
        this.socket.once('end', () => {
            this.debug('[end]');
            // 先下线
            this.handleOffline();

            // 再通知
            this.emit('end', this.socket);
            // 清理
            this.clearReuqestTimeoutMap();
        });

        /**
         * 登录成功后要把缓存的消息发出去
         */
        this.once('online', () => {
            this.sendMessageQueue();
        });
    }

    /**
     * 清理请求定时器
     */
    private clearReuqestTimeoutMap() {
        this.clientRequestTimeoutMap.forEach((t: any) => {
            t && clearTimeout(t);
            t = null;
        });
        this.clientRequestTimeoutMap.clear();
    }

    /**
     * 自动重连
     *
     * retry === true
     */
    private autoRetryConnect() {
        // 错误状态，下线状态，自动配置，客户端创建连接，不是手动关闭，不在定时中
        if ((this.status === 'error' || this.status === 'offline') && this.options.retry && this.options.type === 'client' && !this.isManualClose && !this.retryTimeout) {
            this.debug('[autoRetryConnect]', '自动重连', this.status, this.options, this.isManualClose);
            this.retryTimeout = setTimeout(() => {
                this.reconnect();
                // 开始重连，删掉重连定时
                this.clearRetryTimeout();
            }, this.options.retryDelay || 3000);
        }
    }

    /**
     * 下线
     */
    private handleOffline() {
        if (this.status !== 'offline') {
            this.status = 'offline';
            // 先日志，再回调
            this.debug('[offline]');
            this.emit('offline', this.socket);
        }
    }

    /**
     * 清理重连定时器
     */
    private clearRetryTimeout() {
        this.debug('[clearRetryTimeout]');
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
    }

    /**
     * 心跳机制
     */
    private handleHeartbeat() {
        // 移除定时
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.options.heartbeat) {
            this.heartbeatInterval = setInterval(() => {
                if (this.status === 'online') {
                    this.debug('[heartbeat]', '发起心跳');
                    this.request(SocketSysEvent.socketHeartbeat, { start: this.clientId, socketId: this.getSocketId() })
                        .then((result) => {
                            this.debug('[heartbeat]', '心跳结果', result);
                            this.emit('heartbeat', null, result);
                        })
                        .catch((e) => {
                            this.logError('[heartbeat]', e);
                            this.emit('heartbeat', e, null);
                        });
                }
            }, this.options.heartbeat);
        }
    }
}
