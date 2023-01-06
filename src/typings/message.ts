import { SocketType } from './enum';

/**
 * 消息类型
 */
export enum SocketMessageType {
    request = 'request',
    publish = 'publish',
    response = 'response'
}

/**
 * 消息发出端类型
 */
export type SocketMessageFromType = SocketType;
/**
 * 消息体结构
 */
export type SocketMessage = {
    msgId: string; // 请求id 唯一值
    action: string; // 动作
    time: number; // 消息时间
    headers: {
        host: string;
        port: number;
    };
    content: {
        content?: any | null;
        developerMsg?: Error | null;
    };
    targetId: string; // 目标id
    fromId: string; // 来自id
    type: SocketMessageType; // 消息类型，请求或者发布，请求有消息回调，发布没有回调
    fromType: SocketMessageFromType; // 判断是谁发的
};
