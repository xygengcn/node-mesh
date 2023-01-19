import ServerSocket from '@/lib/socket/server';
import { NodeAction } from '@/typings/node';
import Node from '..';

// 配置
interface MasterOptions {
    secret?: string; // 密钥
    port: number; // 端口 default：31000
}

export default class Master<T extends NodeAction = NodeAction> extends Node<T> {
    // 构建干支
    constructor(id: string, options: MasterOptions) {
        super();
        this.socket = new ServerSocket({ serverId: id, ...options });
        this.created();
        this.socket.start();
    }
}
