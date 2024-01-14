import Socket, { SocketStatus } from '@/lib/socket';
import { type Transport } from '@/lib/transport';

/**
 * 服务端连接
 */
export default class Connection {
    // id
    public readonly id: string;

    // 名字
    public name: string = '';

    // socket
    public socket: Socket;

    // transport
    public transport: Transport;

    // 状态
    public get status() {
        return this.socket?.status || SocketStatus.offline;
    }

    constructor(id: string, socket: Socket, transport: Transport) {
        this.id = id;
        this.socket = socket;
        this.transport = transport;
    }

    /**
     * 销毁
     *
     * 1、有重复的id出现
     */
    public async close() {
        await this.transport?.$destroy();
        this.transport = null;
        this.socket = null;
    }

    /**
     * 绑定名字
     */
    public bindName(name: string) {
        this.name = name;
        this.socket.bindName(name);
    }
}
