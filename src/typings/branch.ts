/**
 * 分支动作
 */
export type BranchAction = Record<string, ((...args: any[]) => Promise<void>) | ((...args: any[]) => void)>;

/**
 * 获取函数名
 */
type BranchActionKey<F extends BranchAction> = keyof F;

/**
 * 函数内容
 */
type BranchActionFunction<F extends BranchAction, K extends BranchActionKey<F>> = K extends BranchActionKey<F> ? F[K] : never;

/**
 * 函数返回内容
 */
type BranchActionResult<F extends BranchAction, K extends BranchActionKey<F>> = K extends BranchActionKey<F> ? ReturnType<BranchActionFunction<F, K>> : Promise<any>;

/**
 * 函数参数
 */

type IQuarkServiceActionFunctionParam<F extends BranchAction, K extends BranchActionKey<F>> = K extends BranchActionKey<F> ? Parameters<BranchActionFunction<F, K>> : never;

/**
 * 返回，同步变异步
 */
export type BranchActionPromise<F extends BranchAction> = {
    [K in BranchActionKey<F>]: BranchActionResult<F, K> extends Promise<any>
        ? BranchActionFunction<F, K>
        : (...args: IQuarkServiceActionFunctionParam<F, K>) => Promise<BranchActionResult<F, K>>;
};
