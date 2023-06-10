import { EventEmitter } from '@/emitter';
import CustomError, { CustomErrorCode } from '@/error';
import { Message, isRequestMessage, MessageType } from '@/lib/message';
import { Callback } from '@/typings';
import { parseError } from '@/utils';

export interface IRequestOptions {
    timeout?: number; // 单位毫秒 默认 10000
}

/**
 * 请求者
 */
export default class Requestor extends EventEmitter<Record<string, any>> {
    /**
     * 配置
     */
    public options: IRequestOptions;
    /**
     * 消息计时器暂存
     */
    public messageRequestMap: Map<string, NodeJS.Timer> = new Map();

    constructor(options: IRequestOptions) {
        super();
        this.options = options || {};
    }

    /**
     * 请求
     * @param message
     * @param callback
     */
    public createRequest(message: Message, callback: Callback): this {
        // 判断是不是消息
        if (!isRequestMessage(message)) {
            callback(TypeError('类型错误'), null);
            return this;
        }

        // 存在回调
        if (callback && typeof callback === 'function') {
            // 存在计时器要清理掉
            const clearTimerEvent = () => {
                if (this.messageRequestMap.has(message.id)) {
                    clearTimeout(this.messageRequestMap.get(message.id));
                    this.messageRequestMap.delete(message.id);
                }
            };
            // 时间超时
            const timeoutErrorEvent = () => {
                clearTimerEvent();
                // 回调错误
                callback(new CustomError(CustomErrorCode.requestTimeout, 'Request Timeout'), null);
                this.$off(`${MessageType.callback}:${message.id}`, timeoutErrorEvent);
            };
            // 建立五秒回调限制
            const eventTimeout = setTimeout(timeoutErrorEvent, this.options.timeout || 10000);

            // 保存单次请求计时器
            this.messageRequestMap.set(message.id, eventTimeout);

            // 收到回调
            this.$once(`${MessageType.callback}:${message.id}`, (error, result) => {
                clearTimerEvent();
                // 需要处理错误信息
                callback(parseError(error), result);
            });
        }
        return this;
    }

    public $destroy() {
        this.messageRequestMap.forEach((item) => {
            clearTimeout(item);
        });
        this.messageRequestMap.clear();
        // 移除所有回调
        this.$off();
    }
}
