import { EventEmitter } from '@/emitter';
import { isFunction, isString } from '@/utils';

/**
 * 订阅者
 */
export default class Subscriber extends EventEmitter<{ [key: string]: (...args: any[]) => void }> {
    /**
     * 订阅key
     */
    private subscribeNames: Set<string> = new Set();
    /**
     * 发布
     * @param action
     * @param args
     */
    public pub(action: string, ...args: any[]) {
        this.$emit(action, ...args);
    }
    /**
     * 添加订阅
     * @param action
     * @param handler
     */
    public sub(action: string, handler?: (...args: any[]) => void) {
        if (isString(action)) {
            this.subscribeNames.add(action);
            if (isFunction(handler)) {
                this.$on(action, handler);
            }
        }
    }

    /**
     * 取消订阅
     * @param action
     */
    public unsub(action: string) {
        if (isString(action)) {
            this.$off(action);
        }
    }

    /**
     * 订阅
     * @param action
     * @returns
     */
    public hasSub(action: string) {
        return this.subscribeNames.has(action);
    }

    /**
     * 订阅事件
     * @returns
     */
    public toSubscribeKeys(): string[] {
        return Array.from(this.subscribeNames.keys());
    }

    /**
     * 取消所有订阅
     *
     * 暂时用不到
     */
    public $destroy() {
        this.$off();
        this.subscribeNames.clear();
    }
}
