import { clientSocketBindMiddleware } from '@/middlewares/client-bind';
import { clientSocketMessageMiddleware } from '@/middlewares/client-message';
import { clientSocketSysMessageMiddleware } from '@/middlewares/client-sys-message';
import { ClientMiddleware, ClientSocketEvent, ClientSocketOptions, ClientSocketStatus, SocketMessage, SocketResponseAction } from '@/typings/socket';
import { compose, parseError, stringifyError, uuid } from '@/utils';
import { Stream } from 'amp';
import Message from 'amp-message';
import { Socket } from 'net';
import Emitter from '../emitter';

/**
 * 客户端
 *
 */
export default class ClientSocket extends Emitter<ClientSocketEvent> {
    // 状态
    public status: ClientSocketStatus = 'none';

    // 配置
    public options: ClientSocketOptions = { retry: true, host: '0.0.0.0', port: 31000, type: 'client', id: 'Client', targetId: 'Server' };

    // 数据
    public body: Buffer | null = null;

    // 对象
    public socket!: Socket;

    // 重连配置
    private retryTimeout: NodeJS.Timer | null = null;

    // 手动关闭
    private isManualClose = false;

    // 记录每次请求
    private clientRequestTimeoutMap: Map<string, NodeJS.Timer> = new Map();

    // 记录response的函数
    public clientHandleResponseMap: Map<string, { callback: SocketResponseAction; once: boolean }> = new Map();

    // @todo 离线状态发送消息缓存
    // private messageCacheQueue: Set<SocketMessage> = new Set();

    // 中间件
    private middlewares: Map<string, { middlewares: ClientMiddleware[]; plugin: (_this: ClientSocket) => Promise<void> }> = new Map();

    // 构造
    constructor(options: ClientSocketOptions, socket?: Socket) {
        const namespace = `clientSocket-${options.type || 'client'}-${options.id}`;
        super(namespace);
        // 配置初始化
        this.options = Object.assign(this.options, options || {});
        // 初始化
        if (socket && socket instanceof Socket) {
            this.socket = socket;
            this.status = 'binding';
            this.listenSocketEvent();
        } else {
            this.status = 'none';
            // 创建Socket
            this.socket = new Socket();
        }

        // 绑定中间件
        this.use('connect', clientSocketBindMiddleware());
        // 处理系统隐藏消息
        this.use('data', clientSocketSysMessageMiddleware());
        // 处理普通请求消息
        this.use('data', clientSocketMessageMiddleware());
    }

    /**
     * 插件
     * @param hook string
     * @param middleware ClientMiddleware
     */
    public use(hook: 'data' | 'connect' | 'socket:bind', middleware: ClientMiddleware) {
        if (typeof middleware !== 'function') throw new TypeError('middleware must be a function!');
        const hookMiddleware = this.middlewares.get(hook);
        const middlewares: ClientMiddleware[] = (hookMiddleware?.middlewares || []).concat([middleware]);
        const plugin = compose(middlewares);
        this.middlewares.set(hook, { middlewares, plugin });
    }

    /**
     * 重新设置配置
     *
     * @param options
     */
    public setDefaultOptions(options: Partial<Pick<ClientSocketOptions, 'targetId' | 'timeout' | 'retryDelay'>>) {
        Object.assign(this.options, options || {});
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
            this.emit('error', new TypeError('port为空'));
        }

        // 在线不需要连接
        if (this.status === 'online') {
            return;
        }

        this.log('[create-connect]', '创建连接', this.options);

        this.status = 'pending';

        // 开始链接
        this.socket.connect(this.options.port, this.options.host);

        // 保持活跃
        this.socket.setKeepAlive(true, 1000);

        // 链接事件
        this.socket.once('connect', () => {
            this.log('[connect]', '连接到服务端', this.socket.address(), this.socket.localAddress);
            // 解除手动限制，手动断开后手动连接后的自动重连
            this.isManualClose = false;

            // 使用插件
            this.useHook('connect', this.socket);

            // 连接成功，删掉重连定时
            this.clearRetryTimeout();
        });

        // 绑定事件
        this.listenSocketEvent();
    }

    /**
     * 重连
     */
    public reconnect(options?: Partial<ClientSocketOptions>): void {
        // 更新配置
        if (options && typeof options === 'object') {
            Object.assign(this.options, options);
        }
        this.log('[reconnect]', '准备重连', 'status:', this.status, 'isManualClose: ', this.isManualClose);
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
     * @todo 先查找本地有没有注册，上层实现
     *
     *
     * @param action
     * @param params
     * @param callback
     */
    public request<T extends any = any>(action: string, params: string | number | object, callback: (error: Error | null, result: T) => void): void;
    public request<T = any>(action: string, params: string | number | object): Promise<T>;
    public request(action, params, callback?): any {
        // 日志
        this.log('[request]', this.status);

        // 正常情况,没有callback返回promise
        if (this.socket && this.status === 'online') {
            if (typeof callback === 'function') {
                this.requestMessage(action, params, callback);
                return;
            } else {
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
        }

        // 错误处理

        this.logError('[request]', '发送失败', 'socket状态: ', this.status);

        // 返回失败
        this.emit('error', new Error("Socket isn't connect !"));
        if (typeof callback === 'function') {
            callback(Error("Socket isn't connect !"));
        } else {
            return Promise.reject(Error("Socket isn't connect !"));
        }
    }

    /**
     * 回答事件
     * @param action
     * @param callback
     */
    public response(action: string, callback: SocketResponseAction) {
        if (typeof action === 'string' && typeof callback === 'function') {
            this.clientHandleResponseMap.set(action, { callback, once: false });
            return;
        }
        throw TypeError('Wrong type. Action is a string type and callback is a function');
    }

    /**
     * 发布消息
     *
     * 不会收到回调，不会触发requestCallBack
     *
     * @todo 未测试
     *
     * @param action
     * @param data
     */
    // public publish<T extends any = any>(action: string, data?: T) {
    //     this.log('[publish]', this.status);
    //     if (this.socket && this.status === 'online') {
    //         this.requestMessage(action, data, false);
    //     } else {
    //         this.emit('error', new Error("Socket isn't connect !"));
    //     }
    // }

    /**
     * 订阅事件，不回调给客户端
     *
     * @todo 未测试
     *
     * @param action
     * @param callback
     */
    // public subscribe(action: string, callback: SocketResponseAction<void>): void {
    //     this.clientHandleActionMap.set(action, { action: callback, once: false });
    // }

    /**
     * 发送消息
     * @param args
     */
    public write(...args: any[]): void {
        this.debug('[write]', this.status, ...args);
        if (this.socket && (this.status === 'online' || this.status === 'binding')) {
            const message = new Message(args);
            this.socket.write(message.toBuffer(), (e) => {
                if (e) {
                    this.logError('[write]', '发送失败', e, ...args);
                    this.emit('error', e || Error('write error'));
                } else {
                    this.debug('[write]');
                }
            });
        }
    }

    /**
     * 断开链接
     */
    public disconnect(error?: Error) {
        this.log('[disconnect]', this.status, error);
        this.emit('disconnect', this.socket);
        this.socket?.end();
        this.socket?.destroy(error);
        this.status = 'offline';
        this.isManualClose = true;
    }

    /**
     * 返回所有动作的keys
     * @returns
     */
    public responseKeys() {
        return this.clientHandleResponseMap.keys();
    }

    /**
     * 封装发送消息
     * @param args
     */
    public requestMessage(action: string, params: string | number | object, callback: false): void;
    public requestMessage(action: string, params: string | number | object, callback: (error: Error | null, ...result: any[]) => void): void;
    public requestMessage(action, params, callback) {
        if (this.socket) {
            // 请求时间
            const requestTime = new Date().getTime();

            // 生成唯一id
            const requestId = `${this.options.id}-${uuid()}-${requestTime}`;

            // 消息类型
            const msgType: SocketMessage['type'] = typeof callback === 'boolean' && callback === false ? 'publish' : 'request';

            // log
            this.log('[requestMessage]', '发出消息: ', requestId, '消息类型: ', msgType);

            // 存在回调
            if (callback && typeof callback === 'function') {
                // 存在计时器要清理掉
                const clearTimerEvent = () => {
                    if (this.clientRequestTimeoutMap.has(requestId)) {
                        clearTimeout(this.clientRequestTimeoutMap.get(requestId));
                        this.clientRequestTimeoutMap.delete(requestId);
                    }
                };
                // 时间超时
                const timeoutErrorEvent = () => {
                    clearTimerEvent();
                    // 回调错误
                    callback(new Error('Timeout'));
                    this.off(requestId as any, timeoutErrorEvent);
                };
                // 建立五秒回调限制
                const eventTimeout = setTimeout(timeoutErrorEvent, this.options.timeout || 5000);

                // 保存单次请求计时器
                this.clientRequestTimeoutMap.set(requestId, eventTimeout);

                // 收到回调
                this.once(requestId as any, (error, ...result) => {
                    clearTimerEvent();
                    // 日志
                    this.log('[requestMessage]', '收到消息回调: ', requestId);

                    // 需要处理错误信息
                    callback(parseError(error), ...result);
                });
            }

            // 发送
            this.sendMessage({
                params,
                action,
                requestId,
                time: requestTime
            });
        }
    }

    /**
     * 发送消息
     * @param action
     * @param type
     * @param body
     * @param error
     * @param params
     * @returns
     */
    public sendMessage(message: Partial<SocketMessage> & Pick<SocketMessage, 'action'>): string {
        if (!message.action) return '';
        // 请求时间
        const requestTime = new Date().getTime();
        // 生成唯一id
        const requestId = `${this.options.id}-${uuid()}-${requestTime}`;
        // 发送内容
        const socketMessage: SocketMessage = {
            type: 'request',
            body: {},
            params: {},
            requestId,
            time: requestTime,
            // 传入
            ...(message || {}),
            error: stringifyError(message?.error) as any,
            // 下面的是不能改的
            targetId: this.options.targetId,
            fromId: this.options.id,
            scene: this.options.type || 'client'
        };
        // 发送
        if (socketMessage.action) {
            this.emit('send', socketMessage);
            this.write(socketMessage);
            return socketMessage.requestId;
        }
        return '';
    }

    /**
     *
     * 使用插件
     *
     * @param hook
     * @param args
     */
    public useHook<T extends string = keyof ClientSocketEvent>(hook: T, ...args: T extends keyof ClientSocketEvent ? Parameters<ClientSocketEvent[T]> : any[]): Promise<void> {
        this.emit(hook as any, ...(args as any));
        const plugin = this.middlewares.get(hook);
        if (plugin?.plugin) {
            return plugin.plugin.call(this, this);
        }
        return Promise.resolve();
    }

    /**
     * 监听事件
     */
    private listenSocketEvent() {
        this.debug('[listenSocketEvent] 开始绑定事件');

        // 接收来自服务端的信息
        const stream = new Stream();
        this.socket.pipe(stream);
        stream.on('data', (buf) => {
            // 日志
            this.log('[data]', this.options.id, '收到消息');

            // 赋值
            this.body = buf;

            // data hook
            this.useHook('data', buf);
        });

        // 有错误发生调用的事件
        this.socket.on('error', (e: Error & { code: string }) => {
            // 日志
            this.logError('[error]', e);
            this.status = 'error';
            this.emit('error', e);

            if (e.code === 'ECONNREFUSED') {
                // 网络问题，重连机制
                this.autoRetryConnect();
            }
        });

        // socket关闭的事件
        this.socket.once('close', () => {
            this.log('[close]');
            this.status = 'offline';
            this.emit('close', this.socket);

            this.socket.removeAllListeners();

            // 清理
            this.clearReuqestTimeoutMap();

            // 关闭触发，重连机制
            this.autoRetryConnect();
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
            this.log('[end]');
            this.status = 'offline';
            this.emit('end', this.socket);

            // 清理
            this.clearReuqestTimeoutMap();

            // 关闭触发，重连机制
            this.autoRetryConnect();
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
            this.log('[autoRetryConnect]', '自动重连', this.status, this.options, this.isManualClose);
            this.retryTimeout = setTimeout(() => {
                this.reconnect();
                // 开始重连，删掉重连定时
                this.clearRetryTimeout();
            }, this.options.retryDelay || 3000);
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
}
