import { SocketMessage } from '@/typings/message';
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
     * 日志
     */
    public log: Emitter['log'];
    public debug: Emitter['debug'];
    public logError: Emitter['logError'];
    public success: Emitter['success'];

    constructor(data: Buffer | unknown, client: ClientSocket) {
        this.id = client.clientId;
        this.client = client;
        this.body = data;
        this.socket = client.socket;
        this.log = client.log.bind(client);
        this.debug = client.debug.bind(client);
        this.logError = client.logError.bind(client);
        this.success = client.success.bind(client);
    }

    /**
     * 转换数据
     * @returns
     */
    public toJson(): SocketMessage {
        return parseMessage(this.body) as SocketMessage;
    }

    /**
     * 发送消息
     */
    public json<T = any>(msg: Partial<SocketMessage<T>>) {
        const message = this.toJson();
        return this.client.send({
            action: message?.action,
            ...msg
        });
    }
}
