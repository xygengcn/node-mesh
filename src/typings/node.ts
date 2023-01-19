/**
 * 节点动作
 */
export type NodeAction = Record<string, ((...args: any[]) => Promise<void>) | ((...args: any[]) => void)>;

/**
 * 获取函数名
 */
type NodeActionKey<F extends NodeAction> = keyof F;

/**
 * 函数内容
 */
type NodeActionFunction<F extends NodeAction, K extends NodeActionKey<F>> = K extends NodeActionKey<F> ? F[K] : never;

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
