import { debug, error, log, success, warn } from '@/utils/debug';
import EventEmitter from 'eventemitter3';

// 日志等级
enum EmitterDebugLevel {
    debug = 0,
    log = 1,
    success = 2,
    warn = 3,
    error = 4
}

export type EmitterDebugEvent = 'debug' | 'log' | 'success' | 'warn' | 'error';

/**
 * 事件基础
 */

export default class Emitter<K extends EventEmitter.ValidEventTypes = string | symbol> extends EventEmitter<K> {
    // 事件
    private namespace: string;

    // 上次打印的记录
    private lastConoleLogTime: number = 0;

    // 日志等级
    private debugLevel: EmitterDebugLevel = EmitterDebugLevel.debug;

    constructor(namespace: string, debugLevel?: EmitterDebugEvent) {
        super();
        this.namespace = namespace;
        this.debugLevel = (debugLevel && EmitterDebugLevel[debugLevel]) || EmitterDebugLevel.debug;
    }

    /**
     * debug日志log
     *
     * level 0
     * @param title
     * @param args
     */
    public debug(title: string, ...args: any[]) {
        if (this.debugLevel > EmitterDebugLevel.debug || Number(process.env.DEBUG_LEVEL || 0) > EmitterDebugLevel.debug) return this;
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        debug(time, `[NS-${this.namespace}]`, title, ...args);
        this.emit('emitter:logger', 'debug', title, ...args);
    }

    /**
     * 日志log
     *
     * level 1
     * @param title
     * @param args
     */
    public log(title: string, ...args: any[]) {
        if (this.debugLevel > EmitterDebugLevel.log || Number(process.env.DEBUG_LEVEL || 0) > EmitterDebugLevel.log) return this;
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        log(time, `[NS-${this.namespace}]`, title, ...args);
        this.emit('emitter:logger', 'log', title, ...args);
    }

    /**
     * 成功日志log
     *
     * level 2
     * @param title
     * @param args
     */
    public success(title: string, ...args: any[]) {
        if (this.debugLevel > EmitterDebugLevel.success || Number(process.env.DEBUG_LEVEL || 0) > EmitterDebugLevel.success) return this;
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        success(time, `[NS-${this.namespace}]`, title, ...args);
        this.emit('emitter:logger', 'error', title, ...args);
    }

    /**
     * 警告日志log
     *
     * level 3
     * @param title
     * @param args
     */
    public warn(title: string, ...args: any[]) {
        if (this.debugLevel > EmitterDebugLevel.success || Number(process.env.DEBUG_LEVEL || 0) > EmitterDebugLevel.success) return this;
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        warn(time, `[NS-${this.namespace}]`, title, ...args);
        this.emit('emitter:logger', 'error', title, ...args);
    }

    /**
     * 错误日志log
     *
     * level 4
     * @param title
     * @param args
     */
    public logError(title: string, errorMsg: Error) {
        if (this.debugLevel > EmitterDebugLevel.error || Number(process.env.DEBUG_LEVEL || 0) > EmitterDebugLevel.error) return this;
        const time = this.lastConoleLogTime ? new Date().getTime() - this.lastConoleLogTime + 'ms' : '';
        this.lastConoleLogTime = new Date().getTime();
        error(time, `[NS-${this.namespace}]`, title, errorMsg);
        this.emit('emitter:logger', 'error', title, errorMsg);
    }

    /**
     * 事件监听
     * @param event
     * @param listener
     * @returns
     */
    public on(event: 'emitter:logger', listener: (level: EmitterDebugEvent, title: string, ...args: any[]) => void): this;
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
    public once(event: 'emitter:logger', listener: (level: EmitterDebugEvent, title: string, ...args: any[]) => void): this;
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
    public emit(event: 'emitter:logger', level: EmitterDebugEvent, title: string, ...args: any[]): boolean;
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
    public off(event: 'emitter:logger', listener: (level: EmitterDebugEvent, title: string, ...args: any[]) => void): this;
    public off<T extends EventEmitter.EventNames<K>>(event?: T, listener?: EventEmitter.EventListener<K, T>): this;
    public off(eventName, listener) {
        if (eventName && listener) {
            return super.off(eventName, listener);
        }
        return super.removeAllListeners(eventName);
    }
}
