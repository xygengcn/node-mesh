import { Socket } from 'net';
import { ClientSocketBindStatus } from './enum';

/**
 * 客户端状态 空，请求连接，绑定中，在线，重试，错误，下线
 */
export type ClientSocketStatus = 'none' | 'pending' | 'binding' | 'online' | 'retrying' | 'error' | 'offline';

/**
 * 原生socket事件
 */
export interface NetSocketEvent {
    error: (e: Error) => void; // 错误
    close: (socket: Socket) => void; // 关闭
    end: (socket: Socket) => void; // 结束 比close先执行
    connect: (socket: Socket) => void; // 请求成功
    data: (buf: Buffer, socket: Socket) => void; // socket传送数据
}

/**
 * 客户端自定义事件
 */
export interface ClientSocketEvent extends NetSocketEvent {
    beforeBind: (content: ClientSocketBindOptions, socket: Socket) => void; // 开始绑定，还没发送bind:callback
    afterBind: (content: ClientSocketBindOptions, socket: Socket) => void; // 绑定回调
    send: (content: any) => void; // 回调发出消息
    message: (message: SocketMessage) => void; // 收到规范的消息了
    online: (socket: Socket) => void; // 上线成功
    reconnect: (socket: Socket) => void; // 开始重连
    disconnect: (socket: Socket) => void; // 开始重连
}

/**
 * 客户端连接配置
 */
export interface ClientSocketOptions {
    id: string; // 自己id
    targetId: string; // 目标id
    secret?: string; // 密钥 用来验证密钥
    port: number; // 端口 default：31000
    host: string; // 地址 default：0.0.0.0
    retry?: boolean; // 是否重连 default：true
    retryDelay?: number; // 是否重连 default：3000
    timeout?: number; // 请求超时 default: 5000
    type?: 'client' | 'server'; // 用来判断操作端是客户端还是服务端
}

/**
 * 绑定配置
 */
export interface ClientSocketBindOptions {
    serverId: string; // 目标服务端id
    clientId: string; // 客户端id
    secret?: string; // 密钥 用来验证密钥
    host: string; // 目标地址
    port: number; // 目标端口
    status: ClientSocketBindStatus; // 绑定状态
}

/**
 * 返回绑定结果
 */
export interface ServerSocketBindResult {
    socketId: string;
    status: ClientSocketBindStatus; // 绑定状态
}

/**
 * 消息体结构
 */

export type SocketMessage<B = any, R = any> = {
    requestId: string; // 请求id 唯一值
    time: number; // 消息时间
    action: string; // 动作
    body: B; // 返回体
    params: R; // 请求参数
    error: Error | null; // 错误
    targetId: string; // 目标id
    fromId: string; // 来自id
    type: 'request' | 'publish' | 'response'; // 消息类型，请求或者发布，请求有消息回调，发布没有回调
    scene: 'client' | 'server'; // 判断是谁发的
};

/**
 * 注册动作函数
 */
export type SocketResponseAction<T extends any = any> = (params: SocketMessage['params']) => T;
