import ServerSocket from '@/lib/socket/server';
import { SocketBroadcastMsgContent } from '@/typings';
import { NodeAction, NodeSysAction, NodeActionFunctionParam, NodeActionPromise, NodeActionResult, NodeEmitKey, NodeOnListener } from '@/typings/node';
import { ClientSocketEvent, ServerSocketEvent, SocketCallback, SocketResponseAction, SocketType } from '@/typings/socket';
import { EmitterDebugEvent } from '../emitter';
import BaseError from '../error';
import ClientSocket from '../socket/client';

export interface NodeOptions {
    debug?: EmitterDebugEvent; // 日志
}

export default class Node<Action extends NodeAction, Type extends SocketType> {
    /**
     * 对象
     */
    protected socket!: Type extends SocketType.client ? ClientSocket : ServerSocket;

    // 构建分支
    constructor(options: NodeOptions) {}

    // 创建成功
    protected created() {
        // 绑定监听事件
        this.on = this.socket.on.bind(this.socket) as any;
        this.emit = this.socket.emit.bind(this.socket);
        this.publish = this.socket.publish.bind(this.socket);
        this.subscribe = this.socket.subscribe.bind(this.socket);
        this.unsubscribe = this.socket.unsubscribe.bind(this.socket);
        this.broadcast = this.socket.broadcast.bind(this.socket);
    }

    /**
     * 事件触发
     */
    public emit!: <Key extends string>(action: NodeEmitKey<Key, Action & ClientSocketEvent & ServerSocketEvent>, ...content: any[]) => void;

    /**
     * 事件监听
     */
    public on!: <T extends string = Type extends SocketType.client ? keyof ClientSocketEvent : keyof ServerSocketEvent>(
        event: T,
        listener: NodeOnListener<T, Action, Type extends SocketType.client ? ClientSocketEvent : ServerSocketEvent>
    ) => void;

    /**
     * 发布者
     */
    public publish!: <T = any>(action: string, content: T, developerMsg?: Error | undefined) => void;

    /**
     * 订阅者
     */
    public subscribe!: (action: string, cb: SocketCallback) => void;

    /**
     * 广播
     */
    public broadcast!: (action: string, content: SocketBroadcastMsgContent) => void;

    /**
     * 取消订阅者
     */
    public unsubscribe!: (action: string) => void;

    /**
     * 创建请求
     */
    public request<K extends keyof NodeSysAction = keyof NodeSysAction>(
        action: K,
        ...params: NodeActionFunctionParam<NodeSysAction, K>
    ): Promise<NodeActionResult<NodeSysAction, K>>;
    public request<K extends keyof NodeAction = keyof NodeAction>(action: K, ...params: NodeActionFunctionParam<Action, K>): Promise<NodeActionResult<Action, K>>;
    public request(action, ...params) {
        return this.socket.request(action, ...params);
    }

    /**
     * 断开
     */
    public stop() {
        return this.socket.disconnect();
    }

    /**
     * 创建返回
     * @param action
     * @param callback
     * @returns
     */
    public response(action: string, callback: SocketResponseAction) {
        return this.socket.response(action, callback);
    }

    /**
     * 批量注册方法
     * @param actions
     * @returns
     */
    public createResponder(actions: NodeAction): Node<Action, Type> {
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
    public createRequester(): NodeActionPromise<Action> {
        /**
         * 创建代理
         */
        const proxy = new Proxy<NodeActionPromise<Action>>({} as NodeActionPromise<Action>, {
            set(target, name, value, receiver) {
                throw new BaseError(30011, (name as string) + '是只读属性');
            },
            get: (target, name: string, receiver) => {
                return (...params: any) => {
                    return this.request(name, ...params);
                };
            }
        });
        return proxy;
    }
}
