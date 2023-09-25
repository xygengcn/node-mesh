import { isFunction, isString } from '@/utils';
import Handler, { IHandler } from './handler';

export default class Responder {
    /**
     * action为索引
     *
     *
     * 先实现action 单一动作
     */
    private handlerManager: Map<string, Handler> = new Map();

    /**
     * 名称
     */
    private readonly namespace: string;

    constructor(namespace: string) {
        this.namespace = namespace;
    }

    /**
     * 插入
     * @param action
     * @param callback
     */
    public createHandler(action: string, callback: IHandler | string) {
        if (!isString(action)) {
            throw TypeError('action不存在');
        }
        // 有callback说明是服务端的，服务端的优先级高
        if (this.hasHandlerCallback(action)) {
            return;
        }

        // 判断存不存在
        if (this.handlerManager.has(action)) {
            return;
        }

        const handler = new Handler(this.namespace, action);
        if (isFunction(callback) && typeof callback === 'function') {
            handler.setCallback(callback);
        } else if (isString(callback) && typeof callback === 'string') {
            handler.setSocketId(callback);
        } else {
            return;
        }
        this.handlerManager.set(action, handler);
    }

    /**
     * 执行并返回
     * @param action
     * @param args
     */
    public requestHandler(action: string): Handler {
        return this.handlerManager.get(action);
    }

    /**
     * 回调
     * @param handler
     * @param params
     * @returns
     */
    public async callback(handler: IHandler, params: any[]) {
        let body: any = null;
        let error: null | Error = null;
        try {
            body = await handler.apply(undefined, params);
        } catch (e: any) {
            error = e;
        }
        return {
            error,
            body
        };
    }

    /**
     * 是否有这个动作
     * @param action
     * @returns
     */
    public hasHandler(action: string): boolean {
        return this.handlerManager.has(action);
    }

    /**
     * 是否有callback
     * @param action
     * @returns
     */
    public hasHandlerCallback(action: string) {
        if (this.hasHandler(action)) {
            const handler = this.handlerManager.get(action);
            return isFunction(handler.callback);
        }
    }

    /**
     * 移除某个action
     *
     * 用于客户端下线使用
     * @param action
     * @param remoteId
     */
    public removeHandler(remoteId: string) {
        this.handlerManager.forEach((handler) => {
            if (handler.remoteId === remoteId) {
                this.handlerManager.delete(handler.action);
            }
        });
    }

    /**
     * 所有动作
     */
    public toHandlerEvents() {
        return Array.from(this.handlerManager.keys());
    }
}
