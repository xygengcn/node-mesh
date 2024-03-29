import { isFunction, isString } from '@/utils';
import Handler, { IHandler } from './handler';

export default class Responder {
    /**
     * action为索引
     *
     *
     * 先实现action 单一动作
     */
    public handlerManager: Map<string, Handler> = new Map();

    /**
     * 插入
     * @param action
     * @param callback
     */
    public createHandler(action: string, namespace: string, callback: IHandler | string) {
        // 有callback说明是服务端的，服务端的优先级高
        if (this.hasHandlerCallback(action)) {
            return;
        }

        // 判断存不存在，存在则移除
        if (this.handlerManager.has(action)) {
            const handler = this.handlerManager.get(action);
            // 相同则跳过
            if (handler.remoteId === callback) {
                return;
            }
            // 不同则移除
            handler.destroy();
            this.handlerManager.delete(action);
        }

        // 新建处理
        const handler = new Handler(namespace, action);

        // 函数回调，主要是本地处理
        if (isFunction(callback) && typeof callback === 'function') {
            handler.setCallback(callback);
        } else if (isString(callback) && typeof callback === 'string') {
            // 客户端处理
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
     * 返回本地动作
     */
    public toLocalEvents() {
        const events: string[] = [];
        this.handlerManager.forEach((handler, key) => {
            if (handler.callback) {
                events.push(key);
            }
        });
        return events;
    }
}
