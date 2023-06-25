import Server, { IServerEvent, IServerOptions } from '@/lib/server';
import { NodeAction, NodeActionFunctionParam, NodeActionPromise, NodeActionResult, NodeOnListener, Promisify } from './type';
import Client, { IClientEvent, IClientOptions } from '@/lib/client';
import { Callback, Constructor } from '@/typings';
import { MiddlewareFunction } from '@/lib/middleware';
import { EmitterDebugLevel } from '@/emitter';
import { IHandler } from '@/lib/responder/handler';

/**
 * 通信者身份
 */
export enum NodeType {
    client = 'client',
    server = 'server'
}

/**
 * 节点
 */
export type NodeFactory<T extends NodeType> = T extends NodeType.client ? Client : Server;

/**
 * 配置
 */
export type NodeOptions<T extends NodeType> = T extends NodeType.client ? IClientOptions : IServerOptions;

/**
 * 创建节点
 * @param type
 * @param options
 * @returns
 */
function createNodeFactory<T extends NodeType = NodeType.client>(type: T, options: NodeOptions<T>): NodeFactory<T> {
    return (type === NodeType.client ? new Client(options) : new Server(options)) as NodeFactory<T>;
}

/**
 * 节点
 */
export default class Node<NodeResponder extends NodeAction, Type extends NodeType> {
    /**
     * 对象
     */
    protected socket!: NodeFactory<Type>;

    // 构建分支
    constructor(type: Type, options: NodeOptions<Type>) {
        this.socket = createNodeFactory(type, options);
        setImmediate(() => {
            this.socket.createSocket();
            this.socket.connect();
        });
    }

    /**
     * 事件监听
     */
    public $on(event: 'logger', listener: (level: EmitterDebugLevel, title: string, ...args: any[]) => void): void;
    public $on<T extends Type extends NodeType.client ? keyof IClientEvent : keyof IServerEvent>(
        event: T,
        listener: NodeOnListener<T, NodeResponder, Type extends NodeType.client ? IClientEvent : IServerEvent>
    ): void;
    public $on(event, listener) {
        if (event === 'logger') {
            event = 'emitter:logger';
        }
        this.socket.$on(event, listener);
    }

    /**
     * 事件移除
     */
    public $off(event: 'logger', listener: (level: EmitterDebugLevel, title: string, ...args: any[]) => void): void;
    public $off<T extends Type extends NodeType.client ? keyof IClientEvent : keyof IServerEvent>(
        event: T,
        listener?: NodeOnListener<T, NodeResponder, Type extends NodeType.client ? IClientEvent : IServerEvent>
    ): void;
    public $off(event, listener) {
        this.socket.$off(event, listener);
    }

    /**
     * 发布者
     */
    public publish(action: string, ...args: any[]) {
        return this.socket.publish(action, ...args);
    }

    /**
     * 订阅者
     */
    public subscribe(action: string, cb: IHandler<void>) {
        return this.socket.subscribe(action, cb);
    }

    /**
     * 取消订阅者
     */
    public unsubscribe(action: string) {
        return this.socket.unsubscribe(action);
    }

    /**
     * 广播
     * @param action
     * @param content
     */
    public broadcast(action: string, content: any) {
        return this.socket.broadcast(action, content);
    }

    /**
     * 创建请求
     */
    public request<K extends keyof NodeAction = keyof NodeAction>(
        action: K,
        ...params: NodeActionFunctionParam<NodeResponder, K>
    ): Promisify<NodeActionResult<NodeResponder, K>>;
    public request(action, ...params) {
        return new Promise((resolve, reject) => {
            this.socket.request(action, params, (error, content) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(content);
                }
            });
        });
    }

    /**
     * 创建返回
     * @param action
     * @param callback
     * @returns
     */
    public response(action: string, callback: Callback) {
        return this.socket.response(action, callback);
    }

    /**
     * 批量注册方法
     * @param actions
     * @returns
     */
    public createResponder<T extends NodeAction = NodeResponder>(actions: T): Node<NodeResponder, Type> {
        Object.entries(actions).forEach(([eventName, functionBody]) => {
            if (functionBody instanceof Function) {
                this.response(eventName, functionBody.bind(null));
            }
        });
        return this;
    }

    /**
     * 创建集合请求
     * @returns
     */
    public createRequester<T extends NodeAction = NodeResponder>(): NodeActionPromise<T> {
        /**
         * 创建代理
         */
        const proxy = new Proxy<NodeActionPromise<T>>({} as NodeActionPromise<T>, {
            set(target, name, value, receiver) {
                throw new TypeError((name as string) + '是只读属性');
            },
            get: (target, name: string, receiver) => {
                return (...params: any) => {
                    return this.request(name, ...params);
                };
            }
        });
        return proxy;
    }

    /**
     * 中间件
     * @param middleware
     * @returns
     */
    public use(middleware: Constructor | MiddlewareFunction) {
        return this.socket.use(middleware);
    }

    /**
     * 断开
     */
    public disconnect() {
        this.socket.disconnect();
    }
}
