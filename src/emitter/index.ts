import EventEmitter3 from 'eventemitter3';

/**
 * 日志模式
 */
export type EmitterDebugLevel = 'debug' | 'log' | 'info' | 'success' | 'warn' | 'error';

/**
 * 日志接口
 */
export interface EventEmitterInterface {
    $debug: (...args: any[]) => void;
    $log: (...args: any[]) => void;
    $info: (...args: any[]) => void;
    $success: (...args: any[]) => void;
    $warn: (...args: any[]) => void;
    $error: (...args: any[]) => void;
}

/**
 * 事件基础
 */
export class EventEmitter<K extends Record<string, any> = {}> implements EventEmitterInterface {
    /**
     * 事件
     */
    private $event: EventEmitter3 = new EventEmitter3();

    /**
     * 日志等级
     */
    private level: string[] = [];

    /**
     * 允许所有级别
     */
    private isAllowAllLevel: boolean = false;

    constructor() {
        this.isAllowAllLevel = process.env.NODE_MESH_DEBUG_LEVEL === '*' || process.env.NODE_MESH_DEBUG_LEVEL === 'all';
        this.level = process.env.NODE_MESH_DEBUG_LEVEL ? process.env.NODE_MESH_DEBUG_LEVEL.split('|') : [];
    }

    /**
     * 是否记录
     * @param level
     * @returns
     */
    private isValidLevel(level: EmitterDebugLevel) {
        if (this.isAllowAllLevel) {
            return true;
        }
        if (this.level.length) {
            return this.level.indexOf(level) > -1;
        }
        return true;
    }

    /**
     * debug日志log
     *
     * @param title
     * @param args
     */
    public $debug(title: string, ...args: any[]) {
        if (!this.isValidLevel('debug')) return this;
        this.$emit('emitter:logger', 'debug', title, ...args);
    }

    /**
     * 日志log
     *
     * @param title
     * @param args
     */
    public $log(title: string, ...args: any[]) {
        if (!this.isValidLevel('log')) return this;
        this.$emit('emitter:logger', 'log', title, ...args);
    }

    /**
     * 日志info
     *
     * @param title
     * @param args
     */
    public $info(title: string, ...args: any[]) {
        if (!this.isValidLevel('info')) return this;
        this.$emit('emitter:logger', 'info', title, ...args);
    }

    /**
     * 成功日志log
     *
     * @param title
     * @param args
     */
    public $success(title: string, ...args: any[]) {
        if (!this.isValidLevel('success')) return this;
        this.$emit('emitter:logger', 'success', title, ...args);
    }

    /**
     * 警告日志log
     *
     * @param title
     * @param args
     */
    public $warn(title: string, ...args: any[]) {
        if (!this.isValidLevel('warn')) return this;
        this.$emit('emitter:logger', 'warn', title, ...args);
    }

    /**
     * 错误日志log
     *
     * @param title
     * @param args
     */
    public $error(title: string, errorMsg?: Error) {
        if (!this.isValidLevel('error')) return this;
        this.$emit('emitter:logger', 'error', title, errorMsg);
    }

    /**
     * 事件监听
     * @param event
     * @param listener
     * @returns
     */
    public $on(event: 'emitter:logger', listener: (level: EmitterDebugLevel, title: string, ...args: any[]) => void): this;
    public $on<T extends EventEmitter3.EventNames<K>>(event: T, listener: EventEmitter3.EventListener<K, T>): this;
    public $on(event, listener) {
        this.$event.on(event, listener);
        return this;
    }

    /**
     * 事件监听-次
     * @param event
     * @param listener
     * @returns
     */
    public $once(event: 'emitter:logger', listener: (level: EmitterDebugLevel, title: string, ...args: any[]) => void): this;
    public $once<T extends EventEmitter3.EventNames<K>>(event: T, listener: EventEmitter3.EventListener<K, T>): this;
    public $once(event, listener) {
        this.$event.once(event, listener);
        return this;
    }

    /**
     * 事件触发
     * @param event
     * @param listener
     * @returns
     */
    public $emit(event: 'emitter:logger', level: EmitterDebugLevel, title: string, ...args: any[]): boolean;
    public $emit<T extends EventEmitter3.EventNames<K>>(event: T, ...data: EventEmitter3.EventArgs<K, T>): boolean;
    public $emit(event, ...data: any): boolean {
        return this.$event.emit(event, ...data);
    }

    /**
     * 清理事件
     * @param eventName
     * @param listener
     * @returns
     */
    public $off(event: 'emitter:logger', listener: (level: EmitterDebugLevel, title: string, ...args: any[]) => void): this;
    public $off<T extends EventEmitter3.EventNames<K>>(event?: T, listener?: EventEmitter3.EventListener<K, T>): this;
    public $off(eventName, listener) {
        if (eventName && listener) {
            this.$event.off(eventName, listener);
            return this;
        }
        this.$event.removeAllListeners(eventName);
        return this;
    }

    /**
     * 消息事件
     * @returns
     */
    public toEventNames() {
        return this.$event.eventNames();
    }
}
