import ServerSocket from '@/lib/socket/server';
import { SocketType } from '@/typings';
import { NodeAction } from '@/typings/node';
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
        this.socket.start();
    }
}
