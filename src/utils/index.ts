import safeStringify from 'json-stringify-safe';
/**
 * 生成随机字符串
 * @param length
 * @returns
 */
export function uuid(length?: number): string {
    length = length || 10;
    const chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    const maxPos = chars.length;
    let pwd = '';
    for (let i = 0; i < length; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
}

/**
 * 字符串解析
 * @param str
 * @returns
 */
export function parseJson(str: string | object): object {
    if (typeof str === 'object') {
        return str;
    }
    try {
        return JSON.parse(str);
    } catch (error) {
        return {};
    }
}

/**
 * 解析对象
 * @param obj
 * @returns
 */
export function stringify(obj: object): string {
    return safeStringify(obj);
}

/**
 * 序列化错误对象
 * @param error
 */
export function stringifyError(error: Error | null | undefined) {
    if (!error) return null;
    if (error instanceof Error) {
        const obj = {
            message: error?.message,
            name: error?.name,
            cause: error?.stack,
            stack: error?.stack,
            code: (error as any).code
        };
        return safeStringify(obj);
    }
    return safeStringify({
        message: error
    });
}

/**
 * 解析错误对象
 * @param error
 */
export function parseError(error: Error | null | undefined) {
    if (!error) return null;
    const errObj = parseJson(error) as Error;
    return Error(errObj.message, errObj);
}
