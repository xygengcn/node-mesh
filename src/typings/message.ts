/**
 * 消息类型
 */
export enum SocketMessageType {
    request = 'request', // 请求消息
    response = 'response', // 请求回复消息
    subscribe = 'subscribe', // 订阅消息
    broadcast = 'broadcast' // 广播消息 包括系统通知消息
}

/**
 * 消息体结构
 */
export type SocketMessage<T = any | null> = {
    msgId: string; // 请求id 唯一值
    action: string; // 动作
    type: SocketMessageType; // 消息类型，请求或者发布，请求有消息回调，发布没有回调
    time: number; // 消息时间
    headers: {
        origin: string;
    };
    content: {
        content?: T;
        developerMsg?: Error | null;
    };
    targetId: string; // 目标id
    fromId: string; // 来自id
};

/**
 * 系统默认消息类型
 */
export enum SocketSysEvent {
    socketBind = 'socket:bind', // 绑定通知
    socketNotification = 'socket:notification', // 通用通知消息
    socketOnline = 'socket:online', // 其他客户端上线通知
    socketoffline = 'socket:offline', // 其他客户端下线通知
    socketSub = 'socket:sub' // 客户端增加订阅
}

/**
 * 广播消息
 */
export interface SocketBroadcastMsgContent<T = any, K extends string = string> {
    content: T;
    event: K;
}
export type SocketBroadcastMsg = SocketMessage<SocketBroadcastMsgContent>;

/**
 * 系统消息类型
 */
export type SocketSysMsgContent<T = any, K extends SocketSysEvent = SocketSysEvent> = SocketBroadcastMsgContent<T, K>;

/**
 * 客户端端上线和离线提醒内容
 */
export type SocketSysMsgOnlineOrOfflineContent = SocketSysMsgContent<
    { clientId: string; serverId: string; socketId: string },
    SocketSysEvent.socketOnline | SocketSysEvent.socketoffline
>;

/**
 * 客户端订阅和取消订阅的通知消息
 */
export type SocketSysMsgSubscribeContent = SocketSysMsgContent<{ action: string; subscribe: boolean; socketId: string }, SocketSysEvent.socketSub>;
