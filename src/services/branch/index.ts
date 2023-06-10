import Node, { NodeOptions, NodeType } from '@/services/node';
import { NodeAction } from '../node/type';

// 配置
export interface BranchOptions extends NodeOptions<NodeType.client> {}

export default class Branch<T extends NodeAction = {}> extends Node<T, NodeType.client> {
    // 构建干支
    constructor(id: string, options: Omit<BranchOptions, 'namespace'>) {
        super(NodeType.client, { ...options, namespace: id });
    }
}
