import ServerSocket from '@/lib/socket/server';
import { SocketType } from '@/typings';
import { NodeAction, NodeClient } from '@/typings/node';
import Node, { NodeOptions } from '..';

// 配置
interface MasterOptions extends NodeOptions {
    secret?: string; // 密钥
    port: number; // 端口 default：31000
}

export default class Master<T extends NodeAction = {}> extends Node<T, SocketType.server> {
    // 构建干支
    constructor(id: string, options: MasterOptions) {
        super(options);
        this.socket = new ServerSocket({ serverId: id, ...options });
        this.created();

        this.beforeStart();

        this.socket.start();
    }

    private beforeStart() {
        // 注册用户
        this.response('node:clients', () => {
            const clients: NodeClient[] = [];
            this.socket.clients.forEach((client, socketId) => {
                clients.push({
                    status: client.status,
                    clientId: client.targetId,
                    socketId: socketId
                });
            });
            return clients;
        });
    }
}
