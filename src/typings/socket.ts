import Context from '@/lib/context';
import { EmitterDebugEvent } from '@/lib/emitter';
import { Server, Socket } from 'net';
import { ClientSocket } from '..';
import { SocketBroadcastMsgContent, SocketMessage, SocketSysEvent, SocketSysMsgContent } from './message';

/**
 * 客户端和服务端的绑定状态
 */
export enum SocketBindStatus {
    waiting = 0,
    error = 2, // 服务器id失败
    authError = 3, // 验证secret失败
    success = 1
}

/**
 * 通信者身份
 */
export enum SocketType {
    client = 'client',
    server = 'server'
}

/**
 * 客户端状态 空，请求连接，绑定中，在线，重试，错误，下线
 */
export type ClientSocketStatus = 'none' | 'pending' | 'binding' | 'online' | 'error' | 'retrying' | 'offline';

/**
 * 服务端状态
 */
export type ServerSocketStatus = 'none' | 'waiting' | 'pending' | 'online' | 'error' | 'offline';

/**
 * 回调函数
 */
export type SocketCallback = (error?: Error | null, content?: any) => void;

/**
 * socket的消息回调事件
 */
export type SocketMessageEvent = { [key in `${'request' | 'subscribe'}:${string}`]: SocketCallback };

/**
 * 订阅消息
 */
export type SubscribeMessage<T = any> = Pick<SocketMessage<T>, 'action' | 'content' | 'type' | 'fromId'> & { msgId?: string };

/**
 * 原生socket事件
 */
export type NetSocketEvent = SocketMessageEvent & {
    error: (e: Error) => void; // 错误
    close: (socket: Socket) => void; // 关闭 在end事件触发之后触发
    end: (socket: Socket) => void; // 结束 比close先执行
    connect: (socket: Socket) => void; // 请求成功
    data: (buf: Buffer, message: SocketMessage) => void; // socket传送数据
};

/**
 * 原生Server事件
 */
export type NetServerEvent = SocketMessageEvent & {
    error: (e: Error) => void; // server error
    close: (server: Server) => void; // server close
    connect: (socket: Socket) => void; // 客户端连接
    listening: (Server: Server) => void; // 服务端启动 等同于online
    data: (buf: Buffer, message: SocketMessage, client: ClientSocket) => void; // 收到客户端的消息
};

/**
 * 客户端自定义事件
 */
export type ClientSocketEvent = NetSocketEvent & {
    beforeBind: (content: ClientSocketBindOptions, socket: Socket) => void; // 开始绑定，还没发送bind:callback
    afterBind: (content: ServerSocketBindResult, socket: Socket) => void; // 绑定回调
    offline: (socket: Socket) => void; // 自己下线成功
    reconnect: (socket: Socket) => void; // 开始重连

    disconnect: (socket: Socket) => void; // 开始重连
    send: (message: SocketMessage) => void; // 发出消息
    online: (socket: Socket) => void; // 自己上线成功
    broadcast: (action: string | SocketSysEvent, content: SocketBroadcastMsgContent) => void; // 收到广播消息
    message: (message: SocketMessage) => void; // 收到规范的消息了
    sysMessage: (content: SocketSysMsgContent) => void; // 收到系统消息
    subscribe: (message: SubscribeMessage) => void; // 收到订阅的消息了
};

/**
 * 服务端事件
 */
export type ServerSocketEvent = NetServerEvent & {
    send: (message: SocketMessage) => void; // 发出消息
    online: (socket: Server) => void; // 自己上线成功
    disconnect: (socket: Server) => void; // 开始重连
    message: (message: SocketMessage, client: ClientSocket) => void; // // client send message
    sysMessage: (content: SocketSysMsgContent) => void; // 收到系统消息
    broadcast: (action: string | SocketSysEvent, content: SocketBroadcastMsgContent) => void; // 收到广播消息
    subscribe: (message: SubscribeMessage) => void; // 收到订阅的消息了
};

/**
 * 客户端连接配置
 */
export interface ClientSocketOptions {
    clientId: string; // 自己id
    targetId: string; // 目标id，在服务端，targetId为客户端id
    secret?: string; // 密钥 用来验证密钥
    port: number; // 端口 default：31000
    host: string; // 地址 default：0.0.0.0
    retry?: boolean; // 是否重连 default：true
    retryDelay?: number; // 是否重连 default：3000
    timeout?: number; // 请求超时 default: 30000
    type?: SocketType; // 用来判断操作端是客户端还是服务端
    debug?: EmitterDebugEvent; // 日志
}

/**
 * 绑定配置
 */
export interface ClientSocketBindOptions {
    clientId: string; // 自己id
    serverId: string; // 目标id
    secret?: string; // 密钥 用来验证密钥
    host: string; // 目标地址
    port: number; // 目标端口
    status: SocketBindStatus; // 绑定状态
    responseActions: string[]; // 注册的动作
    subscription: string[]; // 注册的动作
    socketId: string; // socket 唯一值
}

/**
 * 返回绑定结果
 */
export interface ServerSocketBindResult {
    status: SocketBindStatus; // 绑定状态
}

/**
 * 服务端配置
 */
export interface ServerSocketOptions {
    serverId: string; // 名称
    secret?: string; // 密钥
    port: number; // 端口 default：31000
    timeout?: number; // 请求延迟,
    debug?: EmitterDebugEvent; // 日志
}

/**
 * 注册动作函数
 */
export type SocketResponseAction<T extends any = any> = ((...content: any) => T) | ((...content: any) => Promise<T>);

/**
 * 中间件
 */
export type ClientMiddleware = ((context: Context, next: () => void) => void) | ((context: Context, next: () => void) => Promise<void>);
