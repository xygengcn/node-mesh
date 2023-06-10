import { stringifyError } from '@/utils';
import { ErrorObject } from 'serialize-error';
import { uid } from 'uid';

/**
 * 消息类型
 */
export enum MessageType {
    request = 'request', // 请求消息
    callback = 'callback', // 回调消息
    publish = 'publish', // 主动推送的消息
    notification = 'notification' // 通知消息
}

/**
 * 消息来源
 */
export enum MessageSource {
    custom = 'custom', // 通用
    system = 'system' // 系统
}

/**
 * 系统默认动作
 */
export enum MessageSysAction {
    bindAuth = 'action:bindAuth', // 绑定事件
    connected = 'action:connected', // 客户端本地连接事件
    register = 'action:register', // 客户端注册请求方法和订阅信息
    heartbeat = 'action:heartbeat' // 心跳事件
}
/**
 * 消息
 */
export interface IMessage<T = any[], B = any> {
    id: string;
    type: MessageType;
    // 来源
    source: MessageSource;
    // 时间
    time: number;
    // 请求参数
    content: {
        action: string;
        params: T;
    };
    // 返回参数
    data: {
        body: B; // 正确返回
        error: Error | ErrorObject | null; // 返回错误
    };

    // 发送者
    fromId: string;
    // 接受者
    targetId: string;
}

/**
 * 请求消息
 */
export interface IRequestMessage extends IMessage {
    type: MessageType.request;
}

/**
 * 系统消息
 */
export interface ISystemMessage extends IMessage {
    source: MessageSource.system;
}

/**
 * 通知消息
 */
export interface INotifictionMessage extends IMessage {
    type: MessageType.notification;
}
/**
 * 是不是消息
 * @param message
 * @returns
 */
export function isMessage(message: any): boolean {
    return typeof message === 'object' && !!message && message?.id;
}

/**
 * 是不是请求消息
 * @returns
 */
export function isRequestMessage(message: Message | IMessage): boolean {
    return isMessage(message) && message.type === MessageType.request;
}

/**
 * 是不是回调消息
 * @returns
 */
export function isCallbackMessage(message: Message | IMessage): boolean {
    return isMessage(message) && message.type === MessageType.callback;
}

/**
 * 是不是通知消息
 * @returns
 */
export function isNotificationMessage(message: Message | IMessage): boolean {
    return isMessage(message) && message.type === MessageType.notification;
}

/**
 * 是不是推送消息
 * @returns
 */
export function isPushMessage(message: Message | IMessage): boolean {
    return isMessage(message) && message.type === MessageType.publish;
}

/**
 * 是不是系统消息
 * @returns
 */
export function isSysMessage(message: Message | IMessage): boolean {
    return isMessage(message) && message.source === MessageSource.system;
}

/**
 * 消息
 */
export class Message<T extends IMessage = IMessage> {
    /**
     * 消息id
     */
    public readonly id: string = uid(16);

    /**
     * 参数
     */
    public readonly action: MessageSysAction | string = '';

    /**
     * 消息类型
     */
    public readonly type: MessageType = MessageType.request;

    /**
     * 正确返回
     */
    public readonly body: T['data']['body'] = null;

    /**
     * 返回错误
     */
    public readonly error: Error | ErrorObject | null = null;

    /**
     * 请求参数
     */
    public readonly params: T['content']['params'] = [];

    /**
     * 来源
     */
    public readonly source: MessageSource = MessageSource.custom;

    /**
     * 来自
     */
    public readonly fromId: string;

    /**
     * 去向
     */
    public readonly targetId: string;

    constructor(message?: IMessage) {
        if (message) {
            this.id = message.id;
            this.type = message.type;
            this.body = message.data.body;
            this.error = message.data.error;
            this.params = message.content.params || [];
            this.action = message.content.action;
            this.source = message.source;
            this.fromId = message.fromId;
            this.targetId = message.targetId;
        }
    }

    /**
     * 添加来源
     */
    public setSource(source: T extends ISystemMessage ? MessageSource.system : MessageSource): this {
        Reflect.set(this, 'source', source);
        return this;
    }

    /**
     * 添加参数
     * @param params
     */
    public setParams(...params: any[]): this {
        Reflect.set(this, 'params', params || []);
        return this;
    }

    /**
     * 添加类型
     * @param params
     */
    public setType(type: MessageType): this {
        Reflect.set(this, 'type', type);

        return this;
    }

    /**
     * 添加内容
     * @param params
     */
    public setBody(body: any): this {
        Reflect.set(this, 'body', body);
        return this;
    }

    /**
     * 添加错误
     */
    public setError(error: Error | ErrorObject | null): this {
        Reflect.set(this, 'error', error);
        return this;
    }

    /**
     * 添加动作
     */
    public setAction(action: string): this {
        if (action) {
            Reflect.set(this, 'action', action);
        }
        return this;
    }

    /**
     * 设置目标
     * @param id
     * @returns
     */
    public setTarget(id: string) {
        if (id) {
            Reflect.set(this, 'targetId', id);
        }
        return this;
    }

    /**
     * 设置发送者
     * @param id
     * @returns
     */
    public setFrom(id: string) {
        if (id) {
            Reflect.set(this, 'fromId', id);
        }
        return this;
    }

    /**
     * 返回原生消息
     * @returns
     */
    public toRaw(): T {
        const message: IMessage = {
            id: this.id,
            type: this.type,
            source: this.source,
            fromId: this.fromId,
            targetId: this.targetId,
            content: {
                action: this.action,
                params: this.params
            },
            time: Date.now(),
            data: {
                body: this.body,
                error: stringifyError(this.error)
            }
        };
        return message as T;
    }

    /**
     * 创建请求消息
     * @param action
     * @param params
     */
    public static createRequestMessage(action: string, ...params: any[]) {
        const message = new Message();
        message.setAction(action);
        message.setParams(...params);
        message.setType(MessageType.request);
        return message;
    }

    /**
     * 创建
     * @param action
     * @param params
     */
    public static createPublishMessage(action: string, ...params: any[]) {
        const message = new Message();
        message.setAction(action);
        message.setParams(...params);
        message.setType(MessageType.publish);
        return message;
    }

    /**
     * 创建
     * @param action
     * @param params
     */
    public static createNotificationMessage(action: string, ...params: any[]): Message<INotifictionMessage> {
        const message = new Message<INotifictionMessage>();
        message.setAction(action);
        message.setSource(MessageSource.custom);
        message.setParams(...params);
        message.setType(MessageType.notification);
        return message;
    }
}
