import { blueColor, cyanColor, debug, error, log, success } from '@/utils/debug';
import EventEmitter from 'eventemitter3';

// 日志等级
export type EmitterEventLevel = 'success' | 'log' | 'debug' | 'error';

/**
 * 事件基础
 */

export default class Emitter<K extends EventEmitter.ValidEventTypes = string | symbol> extends EventEmitter<K> {
    // 事件
    private namespace: string;

    // 上次打印的记录
    private lastConoleLogTime: number = 0;

    constructor(namespace: string) {
        super();
        this.namespace = namespace;
    }

    /**
     * 日志log
     *
     * level 1
     * @param title
     * @param args
     */
    public log(title: string, ...args: any[]) {
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        Number(process.env.DEBUG_LEVEL || 0) <= 1 && log(cyanColor(time), `[NS-${this.namespace}]`, blueColor(title), ...args);
        this.emit('logger', 'log', title, ...args);
    }

    /**
     * debug日志log
     *
     * level 0
     * @param title
     * @param args
     */
    public debug(title: string, ...args: any[]) {
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        Number(process.env.DEBUG_LEVEL || 0) <= 0 && debug(cyanColor(time), `[NS-${this.namespace}]`, blueColor(title), ...args);
        this.emit('logger', 'debug', title, ...args);
    }

    /**
     * 错误日志log
     *
     * level 3
     * @param title
     * @param args
     */
    public logError(title: string, errorMsg: Error) {
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        Number(process.env.DEBUG_LEVEL || 0) <= 3 && error(cyanColor(time), `[NS-${this.namespace}]`, blueColor(title), errorMsg);
        this.emit('logger', 'error', title, errorMsg);
    }

    /**
     * 成功日志log
     *
     * level 2
     * @param title
     * @param args
     */
    public success(title: string, ...args: any[]) {
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        Number(process.env.DEBUG_LEVEL || 0) <= 2 && success(cyanColor(time), `[NS-${this.namespace}]`, blueColor(title), ...args);
        this.emit('logger', 'error', title, ...args);
    }

    /**
     * 事件监听
     * @param event
     * @param listener
     * @returns
     */
    public on(event: 'logger', listener: (level: EmitterEventLevel, title: string, ...args: any[]) => void): this;
    public on<T extends EventEmitter.EventNames<K>>(event: T, listener: EventEmitter.EventListener<K, T>): this;
    public on(event, listener) {
        return super.on(event, listener);
    }

    /**
     * 事件监听-次
     * @param event
     * @param listener
     * @returns
     */
    public once(event: 'logger', listener: (level: EmitterEventLevel, title: string, ...args: any[]) => void): this;
    public once<T extends EventEmitter.EventNames<K>>(event: T, listener: EventEmitter.EventListener<K, T>);
    public once(event, listener) {
        return super.once(event, listener);
    }

    /**
     * 事件触发
     * @param event
     * @param listener
     * @returns
     */
    public emit(event: 'logger', level: EmitterEventLevel, title: string, ...args: any[]): boolean;
    public emit<T extends EventEmitter.EventNames<K>>(event: T, ...data: EventEmitter.EventArgs<K, T>): boolean;
    public emit(event, ...data: any) {
        return super.emit(event, ...data);
    }

    /**
     * 清理事件
     * @param eventName
     * @param listener
     * @returns
     */
    public off(event: 'logger', listener: (level: EmitterEventLevel, title: string, ...args: any[]) => void): this;
    public off<T extends EventEmitter.EventNames<K>>(event?: T, listener?: EventEmitter.EventListener<K, T>): this;
    public off(eventName, listener) {
        if (eventName && listener) {
            return super.off(eventName, listener);
        }
        return super.removeAllListeners(eventName);
    }
}
