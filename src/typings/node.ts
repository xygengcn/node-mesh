import { ClientSocketStatus } from '@/typings/socket';
import { EmitterDebugEvent } from '@/lib/emitter';

/**
 * 节点动作
 */
export type NodeAction = Record<string, ((...args: any[]) => Promise<void>) | ((...args: any[]) => void)>;

/**
 * 获取函数名
 */
export type NodeActionKey<F extends NodeAction> = keyof F;

/**
 * 函数内容
 */
export type NodeActionFunction<F extends NodeAction, K extends NodeActionKey<F>> = K extends NodeActionKey<F> ? F[K] : never;

/**
 * 函数返回内容
 */
export type NodeActionResult<F extends NodeAction, K extends NodeActionKey<F>> = K extends NodeActionKey<F> ? ReturnType<NodeActionFunction<F, K>> : Promise<any>;

/**
 * 函数参数
 */

export type NodeActionFunctionParam<F extends NodeAction, K extends NodeActionKey<F>> = K extends NodeActionKey<F> ? Parameters<NodeActionFunction<F, K>> : never;

/**
 * 返回，同步变异步
 */
export type NodeActionPromise<F extends NodeAction> = {
    [K in NodeActionKey<F>]: NodeActionResult<F, K> extends Promise<any> ? NodeActionFunction<F, K> : (...args: NodeActionFunctionParam<F, K>) => Promise<NodeActionResult<F, K>>;
};

/**
 * 节点的emit key
 */
export type NodeEmitKey<T extends string, K extends NodeAction> = T extends keyof K | `${'request' | 'subscribe' | 'socket' | 'emitter' | 'node'}:${string}` | 'emitter:logger'
    ? never
    : T;

/**
 * 监听事件 listener
 */
export type NodeOnListener<T extends string, K extends NodeAction, F extends NodeAction> = T extends 'emitter:logger'
    ? (level: EmitterDebugEvent, title: string, ...args: any[]) => void
    : T extends `${'request' | 'subscribe' | 'socket' | 'emitter' | 'node'}:${string}` | keyof K
    ? never
    : (...content: T extends keyof F ? NodeActionFunctionParam<F, T> : any[]) => void;

/**
 * 节点客户端
 */
export interface NodeClient {
    socketId: string;
    clientId: string;
    status: ClientSocketStatus;
}

/**
 * 节点默认事件
 */
export type NodeSysAction = {
    'node:clients': () => Array<NodeClient>;
};
