export type IHandler<T = any> = (...args: any[]) => T | ((...args: any[]) => Promise<T>);

/**
 * 处理器
 */
export default class Handler {
    /**
     * 动作
     */
    public readonly action: string;

    /**
     * 归属哪一个namespace
     */
    public readonly namespace!: string;

    /**
     * 属于socket
     */
    public readonly remoteId: string;

    /**
     * 回调函数
     */
    public readonly callback: IHandler;

    constructor(namespace: string, action: string) {
        this.action = action;
        this.namespace = namespace;
    }

    /**
     * 设置callback
     * @param callback
     */
    public setCallback(callback: IHandler) {
        if (typeof callback === 'function') {
            Reflect.set(this, 'callback', callback);
        } else {
            throw TypeError('callback error');
        }
    }

    /**
     * 设置socketId
     * @param id
     */
    public setSocketId(id: string) {
        if (id) {
            Reflect.set(this, 'remoteId', id);
        }
    }
}
