export * from './message';
export * from './socket';

/**
 * 函数之外
 */
export type NotFunction<T> = T extends Function ? never : T;
