import { SocketBroadcastMsgContent, SocketMessage, SocketMessageType, SocketSysEvent } from '@/typings/message';
import { parseMessage } from '@/utils';
import { Socket } from 'net';
import Emitter from '../emitter';
import ClientSocket from '../socket/client';

export default class Context {
    public id: string;
    /**
     * client
     */
    public client: ClientSocket;

    /**
     * socket
     */
    public socket: Socket;

    /**
     * 数据
     */
    public body: Buffer | unknown;

    /**
     * 消息
     */
    private message!: SocketMessage;

    /**
     * 日志
     */
    public log: Emitter['log'];
    public debug: Emitter['debug'];
    public logError: Emitter['logError'];
    public success: Emitter['success'];

    constructor(client: ClientSocket, data: Buffer | undefined, message: SocketMessage) {
        this.id = client.clientId;
        this.client = client;
        this.socket = client.socket;
        if (data instanceof Buffer) {
            this.body = data;
            this.message = message;
        }
        this.log = client.log.bind(client);
        this.debug = client.debug.bind(client);
        this.logError = client.logError.bind(client);
        this.success = client.success.bind(client);
    }

    /**
     * 转换数据
     * @returns
     */
    public toJson(body?: Buffer): SocketMessage {
        if (this.message && !body) {
            return this.message;
        }
        const messages = parseMessage(body || this.body);
        return messages[0];
    }

    /**
     * 广播
     * @param action
     * @param content
     */
    public broadcast<T extends SocketBroadcastMsgContent = SocketBroadcastMsgContent>(action: string | SocketSysEvent, content: T): string {
        return this.client.broadcast<T>(action, content);
    }

    /**
     * 发送正常消息
     */
    public send<T = any>(msg: Partial<SocketMessage<T>>) {
        const message = this.toJson();
        return this.client.send({
            action: message?.action,
            ...msg
        });
    }

    /**
     * 回复消息
     * @param content
     */
    public json<T = any>(content: T, error?: Error | null) {
        const message = this.toJson();
        return this.client.send({
            action: message?.action,
            msgId: message.msgId,
            type: SocketMessageType.response,
            content: {
                content,
                developerMsg: error || null
            }
        });
    }
}
