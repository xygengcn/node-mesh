import BaseError from '@/lib/error';
import { SocketType, ClientSocketOptions } from '@/typings/socket';
import { AddressInfo, Socket } from 'net';
import ClientSocket from './client';
/**
 * 服务端上线的客户端副本
 */
export default class ServerClientSocket extends ClientSocket {
    /**
     * 客户度端 注册函数keys
     */
    public readonly responseActionKeys: Set<string> = new Set();

    /**
     * 绑定计时，链接后操作2s中不绑定则断开
     */
    private bindSetTimeout: NodeJS.Timeout | null;

    constructor(serverId: string, socket: Socket, options?: Partial<ClientSocketOptions>) {
        const addressInfo = socket.address() as AddressInfo;
        const defaultOptions = {
            port: addressInfo.port,
            host: addressInfo.address,
            type: SocketType.server,
            retry: false,
            clientId: serverId,
            targetId: String(socket.remotePort),
            ...(options || {})
        };
        super(defaultOptions, socket);

        // 开始计时
        this.bindSetTimeout = setTimeout(() => {
            this.disconnect(new BaseError({code:30016,message:'客户端绑定超时',cause:{ socketId: this.getSocketId() }} ));
            this.clearBindSetTimeout();
        }, 2000);
    }

    /**
     * 清除计时
     */
    public clearBindSetTimeout() {
        if (this.bindSetTimeout) {
            clearTimeout(this.bindSetTimeout);
        }
        this.bindSetTimeout = null;
    }
}
