import ServerSocket from '@/lib/socket/server';
import { NodeAction, NodeActionFunctionParam, NodeActionPromise, NodeActionResult } from '@/typings/node';
import { SocketCallback, SocketResponseAction } from '@/typings/socket';
import BaseError from '../error';
import ClientSocket from '../socket/client';

export default class Node<T extends NodeAction = NodeAction> {
    protected socket!: ClientSocket | ServerSocket;

    // 构建分支
    constructor() {}

    // 创建成功
    protected created() {
        // 绑定监听事件
        this.on = this.socket.on.bind(this.socket);
        this.publish = this.socket.publish.bind(this.socket);
        this.subscribe = this.socket.subscribe.bind(this.socket);
        this.unsubscribe = this.socket.unsubscribe.bind(this.socket);
    }

    /**
     * 事件监听
     */
    public on!: ClientSocket['on'] | ServerSocket['on'];

    /**
     * 发布者
     */
    public publish!: <T = any>(action: string, content: T, developerMsg?: Error | undefined) => void;

    /**
     * 订阅者
     */
    public subscribe!: (action: string, cb: SocketCallback) => void;

    /**
     * 取消订阅者
     */
    public unsubscribe!: (action: string) => void;

    /**
     * 创建请求
     */
    public request<K extends keyof NodeAction = keyof NodeAction>(action: K, ...params: NodeActionFunctionParam<T, K>): Promise<NodeActionResult<T, K>> {
        return this.socket.request(action, ...params);
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
    public createResponder(actions: NodeAction): Node<T> {
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
    public createRequester(): NodeActionPromise<T> {
        /**
         * 创建代理
         */
        const proxy = new Proxy<NodeActionPromise<T>>({} as NodeActionPromise<T>, {
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
