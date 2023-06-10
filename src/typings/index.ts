/**
 * 回调
 */
export type Callback<T = any> = (error: Error | null, content: T) => void;

/**
 * 类
 */
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * 函数之外
 */
export type NotFunction<T> = T extends Function ? never : T;
