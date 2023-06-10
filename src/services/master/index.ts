import Node, { NodeOptions, NodeType } from '@/services/node';
import { NodeAction } from '../node/type';

// 配置
export interface MasterOptions extends NodeOptions<NodeType.server> {}

export default class Master<T extends NodeAction = {}> extends Node<T, NodeType.server> {
    // 构建干支
    constructor(id: string, options: Omit<MasterOptions, 'namespace'>) {
        super(NodeType.server, { ...options, namespace: id });
    }
}
