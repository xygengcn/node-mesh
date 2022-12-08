import { blueColor, cyanColor, error, log, success } from '@/utils/debug';
import EventEmitter from 'eventemitter3';

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
     * 设置namespace
     * @param namespace
     */
    public setNamespace(namespace: string) {
        this.namespace = namespace;
    }

    /**
     * 日志log
     * @param title
     * @param args
     */
    public log(title: string, ...args: any[]) {
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        process.env.NODE_ENV === 'development' && log(cyanColor(time), `[namespace-${this.namespace}]`, blueColor(title), ...args);
        this.emit('debug:log', title, ...args);
    }

    /**
     * 错误日志log
     * @param title
     * @param args
     */
    public debug(title: string, ...args: any[]) {
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        process.env.NODE_ENV === 'development' && error(cyanColor(time), `[namespace-${this.namespace}]`, blueColor(title), ...args);
        this.emit('debug:error', title, ...args);
    }

    /**
     * 成功日志log
     * @param title
     * @param args
     */
    public success(title: string, ...args: any[]) {
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        process.env.NODE_ENV === 'development' && success(cyanColor(time), `[namespace-${this.namespace}]`, blueColor(title), ...args);
        this.emit('debug:success', title, ...args);
    }

    /**
     * 事件监听
     * @param event
     * @param listener
     * @returns
     */
    public on<T extends EventEmitter.EventNames<K>>(event: T, listener: EventEmitter.EventListener<K, T>);
    public on(event: string, listener: (...args: any[]) => void);
    public on(event, listener) {
        this.log('Evnet:on]', event);
        return super.on(event, listener);
    }

    /**
     * 事件监听-次
     * @param event
     * @param listener
     * @returns
     */

    public once<T extends EventEmitter.EventNames<K>>(event: T, listener: EventEmitter.EventListener<K, T>);
    public once(event: string, listener: (...args: any[]) => void);
    public once(event, listener) {
        this.log('[Event:once]', event);
        return super.on(event, listener);
    }

    /**
     * 事件触发
     * @param event
     * @param listener
     * @returns
     */
    public emit(event: 'debug:log' | 'debug:success' | 'debug:error', title: string, ...args: any[]);
    public emit<T extends EventEmitter.EventNames<K>>(event: T, ...data: EventEmitter.EventArgs<K, T>);
    public emit(event: string, ...data: any[]);
    public emit(event, ...data: any) {
        return super.emit(event, ...data);
    }

    /**
     * 清理事件
     * @param eventName
     * @param listener
     * @returns
     */
    public off<T extends EventEmitter.EventNames<K>>(event?: T, listener?: EventEmitter.EventListener<K, T>);
    public off(event: string, listener: (...args: any[]) => void);
    public off(eventName, listener) {
        if (eventName && listener) {
            return super.off(eventName, listener);
        }
        return super.removeAllListeners(eventName);
    }
}
