import { IMessage } from '@/lib/message';
import { unpack } from 'msgpackr-node';
import { deserializeError, serializeError } from 'serialize-error';

/**
 * 解压数据
 * @param buf
 * @returns
 */
export function unpackBufToMessage(buf: Buffer): IMessage[] {
    try {
        return unpack(buf);
    } catch (error) {
        return null;
    }
}

/**
 * 序列化错误对象
 * @param error
 */
export function stringifyError(error: any) {
    if (!error) return null;
    return serializeError(error, { maxDepth: 3 });
}

/**
 * 解析错误对象
 * @param error
 * @returns
 */
export function parseError(error: any) {
    if (!error) return null;
    return deserializeError(error);
}

/**
 * compose函数
 * @param middlewares
 * @returns
 */
export function compose(...middlewares: Array<Function>) {
    return function (arg: any) {
        return dispatch(0);
        function dispatch(i: number) {
            let fn = middlewares[i];
            if (!fn) {
                arg = null;
                return Promise.resolve();
            }
            return Promise.resolve(
                fn(arg, function next() {
                    return dispatch(i + 1);
                })
            );
        }
    };
}

/**
 * 是不是对象
 * @param obj
 * @returns
 */
export function isObject(obj: any): boolean {
    return typeof obj === 'object';
}

/**
 * 是不是函数
 * @param func
 * @returns
 */
export function isFunction(func: any): boolean {
    return func && typeof func === 'function';
}

/**
 * 是不是字符串
 * @param str
 * @returns
 */
export function isString(str: any): boolean {
    return str && typeof str === 'string';
}

/**
 * 是不是class
 * @param input
 * @returns
 */
export function isClass(input: unknown) {
    if (isFunction(input)) {
        return /^class /.test(Function.prototype.toString.call(input));
    } else {
        return false;
    }
}

/**
 * 类实例
 * @param instance
 * @returns
 */
export function isClassInstance(instance: any) {
    if (isObject(instance) && instance.constructor) {
        return isClass(instance.constructor);
    }
    return false;
}
