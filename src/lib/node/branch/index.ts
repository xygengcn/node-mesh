import { SocketType } from '@/typings';
import { NodeAction } from '@/typings/node';
import Node, { NodeOptions } from '..';
import ClientSocket from '../../socket/client';

// 配置
interface BranchOptions extends NodeOptions {
    port: number;
    master: string;
    host?: string;
    sercet?: string;
    retry?: boolean; // 是否重连 default：true
    retryDelay?: number; // 重连时间 default：3000
    timeout?: number; // 请求超时 default: 5000
}

export default class Branch<T extends NodeAction = {}> extends Node<T, SocketType.client> {
    // 构建分支
    constructor(id: string, options: BranchOptions) {
        super(options);
        this.socket = new ClientSocket({ clientId: id, targetId: options.master, ...options, host: options.host || '0.0.0.0' });
        this.socket.connect();
        this.created();
    }
}
