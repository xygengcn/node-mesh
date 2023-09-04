import { CONSTANT_KEY } from '@/inversify/inversify.config';
import Sender, { ISenderOptions } from '@/lib/sender';
import Requestor, { IRequestOptions } from '@/lib/sender/requestor';
import Socket, { SocketStatus } from '@/lib/socket';
import { Callback } from '@/typings';
import { isClassInstance } from '@/utils';
import { Message, MessageSource, MessageSysAction, MessageType, isCallbackMessage, isSysMessage } from '../message';
import MiddlewareManager, { MiddlewareClass, MiddlewareFunction } from '../middleware';
import Subscriber from '../subscriber';
import Queue from '@/utils/queue';

export interface ITransportOptions extends ISenderOptions, IRequestOptions {
    namespace: string;
    // 回调并发处理
    handlerConcurrency?: number;

    // 5分钟心跳
    heartbeat?: number;
}

// 心跳参数
export interface IHeartbeatOptions {
    id: string;
    name: string;
    memory: NodeJS.MemoryUsage;
    events: string[];
}

/**
 * 注册动作函数
 */
export type TransportService<T extends any = any> = ((...content: any) => T) | ((...content: any) => Promise<T>);

export class Transport {
    /**
     * 配置
     */
    public readonly options!: ITransportOptions;
    /**
     * 消息暂存
     */
    public messageRequestMap: Map<string, NodeJS.Timer> = new Map();

    /**
     * 发送者
     */
    public sender: Sender;

    /**
     * 请求者
     */
    public requestor: Requestor;

    /**
     * 订阅者
     */
    public subscriber: Subscriber;

    /**
     * 队列
     */
    public onMessageHandlerQueue: Queue;

    // 消息缓存
    private messageManager: Array<Message> = [];

    /**
     * 心跳
     */
    private heartbeatTimeout: NodeJS.Timeout | null;

    // 插件
    private middlewareManager: MiddlewareManager = new MiddlewareManager();

    constructor(options: ITransportOptions) {
        this.options = options;

        // 请求者
        this.requestor = new Requestor(this.options);

        // 发布者
        this.subscriber = new Subscriber();

        // 限制器
        this.onMessageHandlerQueue = new Queue({ concurrency: this.options.handlerConcurrency || 500 });
    }

    /**
     * 创建发送者
     * @param socket
     */
    public createSender(socket: Socket) {
        if (this.sender) {
            this.sender.$destroy();
        }

        this.sender = new Sender(this.options, socket);

        // 注入中间件
        socket.$on('message', (message) => {
            // 加入队列
            this.onMessageHandlerQueue.add(() =>
                this.middlewareManager
                    .execute(message)
                    .then(() => {
                        // 如果是回调消息，需要触发回调
                        if (isCallbackMessage(message)) {
                            this.requestor.$emit(`${MessageType.callback}:${message.id}`, message.error, message.body);
                            return;
                        }
                    })
                    .catch((e) => {
                        socket.$emit('error', e);
                    })
            );
        });

        // 把缓存消息发出去
        socket.$once('online', () => {
            socket.updateStatus(SocketStatus.online);
            if (this.messageManager.length) {
                const messages = this.messageManager.splice(0);
                this.send(...messages);
            }
        });
    }

    /**
     * 请求
     * @param message
     * @param callback
     */
    public request(message: Message, callback: Callback): this {
        // 注册回调
        this.requestor.createRequest(message, callback);
        // 存在sender，且在线 或者是系统消息
        if (this.sender && (this.sender.socket?.status === SocketStatus.online || isSysMessage(message))) {
            this.sender.send(message);
            return;
        }
        this.messageManager.push(message);
        return this;
    }

    /**
     * 注册中间件
     * @param middlewares
     */
    public use(...middlewareList: Array<MiddlewareClass | MiddlewareFunction>) {
        middlewareList.forEach((middleware) => {
            if (isClassInstance(middleware)) {
                Reflect.defineMetadata(CONSTANT_KEY.MIDDLEWARE_TRANSPORT, this, middleware);
            }
            this.middlewareManager.use(middleware);
        });
        return this;
    }

    /**
     * 返回消息
     * @param message
     */
    public callback(message: Message, body: Message['body'], error: Message['error']) {
        if (this.sender) {
            message.setType(MessageType.callback);
            message.setParams();
            message.setBody(body);
            message.setError(error);
            this.send(message);
        }
    }

    /**
     * 发送消息
     */
    public send(...messages: Message[]): void {
        if (this.sender?.socket.readyState === 'open') {
            if (this.sender?.socket?.status === SocketStatus.online) {
                this.sender.send(...messages);
                return;
            }
            messages.forEach((message) => {
                if (isSysMessage(message)) {
                    this.sender.send(message);
                } else {
                    this.messageManager.push(message);
                }
            });

            return;
        } else {
            this.messageManager.push(...messages);
        }
    }

    /**
     * 心跳
     *
     * 10s不活动触发心跳
     */
    public heartbeat(params: IHeartbeatOptions, callback: Callback) {
        this.stopHeartbeat();
        // 没有消息来10秒后开始心跳
        this.heartbeatTimeout = setTimeout(() => {
            const message = new Message();
            message.setSource(MessageSource.system);
            message.setAction(MessageSysAction.heartbeat);
            message.setParams(params);
            this.request(message, callback);
        }, this.options.heartbeat || 5 * 60 * 1000);
    }

    /**
     * 停止心跳
     */
    public stopHeartbeat() {
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
        }
    }

    /**
     * 销毁
     *
     * 1、客户端的disconnect
     *
     * 2、服务端的connection close事件
     */
    public $destroy(force: boolean = false) {
        // 停止心跳
        this.stopHeartbeat();
        // 清掉缓存消息
        this.messageManager = [];
        // 强制清理
        if (force) {
            this.middlewareManager.clear();
        }
        // 销毁定时器
        this.requestor.$destroy();
        // 清除
        return this.sender.$destroy();
    }
}
