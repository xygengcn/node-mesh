import { uuid } from '@/utils';
import net, { Socket } from 'net';
import Emitter from '../emitter';
import _debug from 'debug';
import Message from 'amp-message';

/**
 * 客户端状态 空，请求连接，绑定中，在线，重试，错误，下线
 */
export type ClientSocketStatus = 'none' | 'pending' | 'binding' | 'online' | 'retrying' | 'error' | 'offline';

/**
 * 客户端事件
 */
export type ClientSocketEvent = {
    error: (e: Error) => void; // 错误
    close: (socket: Socket) => void; // 关闭
    end: (socket: Socket) => void; // 结束 比close先执行
    connect: (socket: Socket) => void; // 请求成功
    binding: (content: ClientSocketBindOptions, socket: Socket) => void; // 开始绑定，还没发送bind:callback
    'bind:callback': (content: ClientSocketBindOptions, socket: Socket) => void; // 绑定回调
    data: (buf: Buffer) => void; // socket传送数据
    message: (message: SocketMessage) => void; // 数据传输
    online: (socket: Socket) => void; // 上线成功
};

/**
 * 客户端连接配置
 */
export interface ClientSocketOptions {
    serverId: string; // 目标服务端id
    clientId: string; // 客户端id
    secret?: string; // 密钥 用来验证密钥
    port: number; // 端口 default：31000
    host: string; // 地址 default：0.0.0.0
    retry?: boolean; // 是否重连 default：true
    retryDelay?: number; // 是否重连 default：3000
    timeout?: number; // 请求超时 default: 5000
    type?: 'client' | 'server'; // 用来判断操作端是客户端还是服务端
}

/**
 * 绑定配置
 */
export enum ClientSocketBindStatus {
    waiting = 0,
    error = 2, // 服务器id失败
    authError = 3, // 验证secret失败
    success = 1
}
export interface ClientSocketBindOptions {
    host: string;
    port: number;
    status: ClientSocketBindStatus; // 绑定状态
    secret?: string; // 密钥 用来验证密钥
    serverId: string;
    clientId: string;
}

/**
 * 消息体结构
 */
export interface SocketMessage<B = any, R = any> {
    requestId: string; // 请求id 唯一值
    responseId: string; // 返回id 唯一值
    requestTIme: number; // 请求时间
    action: string; // 动作
    body: B; // 返回体
    params: R; // 请求参数
    error: Error | null; // 错误
    socketId: string; // 连接id
    serverId: string; // 服务端id
    clientId: string; // 客户端id
    type: 'client' | 'server'; // 判断是谁发的
}

/**
 * 注册动作函数
 */
export type ClientSocketAction = (params: any) => any;

/**
 * 客户端
 */
export default class ClientSocket extends Emitter<ClientSocketEvent> {
    // 状态
    public status: ClientSocketStatus = 'none';

    // 配置
    private options: ClientSocketOptions = { retry: true, host: '0.0.0.0', port: 31000, type: 'client', clientId: 'Client', serverId: 'Server' };

    // 对象
    private socket!: Socket;

    // 重连配置
    private retryTimeout: NodeJS.Timer | null = null;

    // 手动关闭
    private isManualClose = false;

    // 记录每次请求
    private clientRequestTimeoutMap: Map<string, NodeJS.Timer> = new Map();

    // 记录注册的函数
    private clientHandleActions: Map<string, { action: ClientSocketAction; once: boolean }> = new Map();

    // 构造
    constructor(options: ClientSocketOptions, socket?: Socket) {
        super(options.clientId);
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

        this.log('[create-connect] 创建连接', this.options);

        this.status = 'pending';

        // 开始链接
        this.socket.connect(this.options.port, this.options.host);

        // 保持活跃
        this.socket.setKeepAlive(true, 1000);

        // 链接事件
        this.socket.once('connect', () => {
            this.log('[connect] 开始连接服务端');
            this.emit('connect', this.socket);

            // 解除手动限制，手动断开后手动连接后的自动重连
            this.isManualClose = false;

            // 等待绑定状态
            this.status = 'binding';

            // 地址
            const addressInfo = this.socket.address() as net.AddressInfo;

            // 绑定数据
            const content: ClientSocketBindOptions = {
                status: ClientSocketBindStatus.waiting,
                port: addressInfo.port,
                host: addressInfo.address,
                clientId: this.options.clientId,
                serverId: this.options.serverId,
                secret: this.options.secret
            };
            // 绑定服务端
            this.bindServer(content);

            // 连接成功，删掉重连定时
            this.clearRetryTimeout();
        });

        // 绑定事件
        this.listenSocketEvent();
    }

    /**
     * 重连
     */
    public reconnect(options?: Partial<ClientSocketOptions>) {
        // 更新配置
        if (options && typeof options === 'object') {
            Object.assign(this.options, options);
        }
        this.log('[reconnect]');
        if (this.status === 'error' || this.status === 'offline') {
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
     * 封装发送消息
     * @param args
     */
    public send<T extends any = any>(action: string, data?: T, callback?: (error: Error | null, ...result: any[]) => void) {
        this.log('[send]', this.status);
        if (typeof data === 'function') {
            callback === data;
            data = undefined;
        }
        if (this.socket && this.status === 'online') {
            this.sendMessage(action, { params: data }, callback);
        } else {
            this.emit('error', new Error("Socket isn't connect !"));
        }
    }

    /**
     * 发送消息
     * @param args
     */
    public write(...args: any[]) {
        this.log('[write]', this.status, ...args);
        if (this.socket && (this.status === 'online' || this.status === 'binding')) {
            const message = new Message(args);
            this.socket.write(message.toBuffer());
        }
    }

    /**
     * 断开链接
     */
    public disconnect(error?: Error) {
        this.log('[disconnect]', this.status, error);
        this.socket?.end();
        this.socket?.destroy(error);
        this.status = 'offline';
        this.isManualClose = true;
    }

    /**
     * 处理事件
     * @param action
     * @param callback
     */
    public handle(action: string, callback: ClientSocketAction) {
        this.clientHandleActions.set(action, { action: callback, once: false });
    }

    /**
     * 处理事件
     * @param action
     * @param callback
     */
    public handleOnce(action: string, callback: ClientSocketAction) {
        this.clientHandleActions.set(action, { action: callback, once: true });
    }

    /**
     * 返回所有动作的keys
     * @returns
     */
    public getHandleActionKeys() {
        return this.clientHandleActions.keys();
    }

    /**
     * 封装发送消息
     * @param args
     */
    private sendMessage(action: string, message?: Partial<SocketMessage>, callback?: (error: Error | null, ...result: any[]) => void) {
        if (this.socket) {
            // 请求时间
            const requestTIme = new Date().getTime();

            // 生成唯一id
            const requestId = `${this.options.clientId}-${uuid()}-${requestTIme}`;

            // log
            this.log('[sendMessage]', requestId);

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
                    this.off(requestId, timeoutErrorEvent);
                };
                // 建立五秒回调限制
                const eventTimeout = setTimeout(timeoutErrorEvent, this.options.timeout || 5000);

                // 保存单次请求计时器
                this.clientRequestTimeoutMap.set(requestId, eventTimeout);

                // 收到回调
                this.once(requestId, (error, ...result) => {
                    clearTimerEvent();
                    callback(error, ...result);
                });
            }

            // 发送内容
            const socketMessage: SocketMessage = {
                requestId,
                responseId: '',
                requestTIme,
                action,
                body: {},
                params: {},
                error: null,
                serverId: this.options.serverId,
                socketId: `${this.options.serverId}-${this.options.clientId}`,
                clientId: this.options.clientId,
                ...(message || {}),
                type: this.options.type || 'client'
            };

            // 发送
            this.write(socketMessage);
        }
    }

    /**
     * 绑定服务端，此动作在客户端执行
     */
    private bindServer(content: ClientSocketBindOptions) {
        this.log('[bindServer]', this.status, content);
        if (this.options.type === 'server') {
            throw new Error('server 不存在 bind 方法');
        }
        // 等待绑定
        if (this.status === 'binding') {
            // 发送绑定事件到客户端
            this.emit('binding', content, this.socket);
            this.sendMessage('socket:bind', { params: content }, (error, result: ClientSocketBindOptions) => {
                // 收到回调
                this.emit('bind:callback', result, this.socket);

                // 日志
                this.log('[bind:callback] ', this.status, result, error);

                // 绑定失败
                if (error || result.status !== ClientSocketBindStatus.success) {
                    this.log('[bind:error] ', this.status, result, error);
                    this.disconnect(error || new Error('Client bind error', { cause: { result, error } }));
                    return;
                }
                // 成功登录
                this.status = 'online';
                this.success('online', this.status);
                this.emit('online', this.socket);
            });
        }
    }

    /**
     * 监听事件
     */
    private listenSocketEvent() {
        this.log('[listenSocketEvent] 开始绑定事件');
        // 接收来自服务端的信息
        this.socket.on('data', (buf) => {
            this.log('[data]', buf.toString());

            // 外发
            this.emit('data', buf);

            const message = new Message(buf);
            // 处理事件
            this.handleSocketAction(message?.args[0]);

            // 在线状态再触发，是固定消息模式
            if (this.status === 'online' && typeof message === 'object' && message?.args?.[0]?.action) {
                this.emit('message', message?.args[0]);
            }
        });

        // 有错误发生调用的事件
        this.socket.on('error', (e: Error & { code: string }) => {
            // 日志
            this.debug('[error]', e);
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

        // 对方发送了关闭数据包过来的事件
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
            this.log('[autoRetryConnect]', this.status, this.options, this.isManualClose);
            this.retryTimeout = setTimeout(() => {
                this.reconnect();
                // 开始重连，删掉重连定时
                this.clearRetryTimeout();
            }, this.options.retryDelay || 3000);
        }
    }

    /**
     * 处理来自对方的数据
     * @param message
     */
    private async handleSocketAction(message: SocketMessage) {
        // log
        this.log('[handleSocketAction]', message);

        // 发出的请求，收到回调
        if (message && typeof message === 'object' && message.responseId && message.action) {
            this.log('[send-callback]', message);
            this.emit(message.responseId, message.error, message.body);
            return;
        }

        // 收到请求，并回答
        if (message && typeof message === 'object' && message.requestId && message.action) {
            // 存在回调
            this.log('[handleSocketAction] 开始处理回调', message);

            // 获取执行函数
            const event = this.clientHandleActions.get(message.action);

            // 结果
            let body = null;

            // 错误
            let error = null;

            // 执行函数
            if (event && typeof event.action === 'function') {
                try {
                    // 运行注册函数
                    body = await event.action(message.params || {});
                    // 一次性的
                    if (event.once) {
                        this.clientHandleActions.delete(message.action);
                    }
                } catch (error: any) {
                    this.emit('error', error);
                    error = error;
                }
            }
            this.emit(message.requestId, message.error, message.body);
            const responseMessage: SocketMessage = {
                requestId: '',
                responseId: message.requestId,
                params: null,
                error,
                body,
                type: this.options.type || 'client',
                action: message.action,
                requestTIme: new Date().getTime(),
                socketId: message.socketId,
                serverId: message.serverId,
                clientId: message.clientId
            };
            this.write(responseMessage);
            return;
        }

        // 普通消息
        this.log('[handleSocketAction] 不处理', message);
    }

    /**
     * 清理重连定时器
     */
    private clearRetryTimeout() {
        this.log('[clearRetryTimeout]');
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
    }
}
