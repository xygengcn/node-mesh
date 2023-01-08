import { BranchAction, BranchActionPromise } from '@/typings/branch';
import { SocketResponseAction } from '@/typings/socket';
import BaseError from '../error';
import ClientSocket from '../socket/client';
import ServerSocket from '../socket/server';

// 配置
interface BranchOptions {
    master: {
        name: string;
        host: string;
    };
    port: number;
    sercet?: string;
    retry?: boolean; // 是否重连 default：true
    retryDelay?: number; // 重连时间 default：3000
    timeout?: number; // 请求超时 default: 5000
}

export default class Branch<T extends BranchAction = BranchAction> {
    private socket!: ClientSocket | ServerSocket;

    // 构建分支
    constructor(id: string, options: BranchOptions) {
        if (options.master) {
            this.socket = new ClientSocket({ clientId: id, host: options.master.host, targetId: options.master.name, ...options });
            this.socket.connect();
        } else {
            this.socket = new ServerSocket({ serverId: id, ...options });
            this.socket.start();
        }
        // 绑定监听事件
        this.on = this.socket.on.bind(this.socket);
    }

    /**
     * 事件监听
     */
    public on: ServerSocket['on'] | ClientSocket['on'];

    /**
     * 创建请求
     */
    public request<T extends any = any>(action: string, params: string | number | object, callback: (error: Error | null, result: T) => void): void;
    public request<T = any>(action: string, params: string | number | object): Promise<T>;
    public async request(action, params, callback?): Promise<any> {
        return this.socket.request(action, params, callback);
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
     * 注册方法
     * @param actions
     * @returns
     */
    public register(actions: BranchAction): Branch<T> {
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
    public createRequester(): BranchActionPromise<T> {
        /**
         * 创建代理
         */
        const proxy = new Proxy<BranchActionPromise<T>>({} as BranchActionPromise<T>, {
            set(target, name, value, receiver) {
                throw new BaseError(30011, (name as string) + '是只读属性');
            },
            get: (target, name: string, receiver) => {
                return (...params: any[]) => {
                    return this.request(name, params);
                };
            }
        });
        return proxy;
    }
}
