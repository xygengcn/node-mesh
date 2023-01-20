export * from './message';
export * from './socket';
export * from './node';

/**
 * 函数之外
 */
export type NotFunction<T> = T extends Function ? never : T;
