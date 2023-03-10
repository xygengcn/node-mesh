import { SocketMessage } from '@/typings/message';
import Message from 'amp-message';
import { deserializeError, serializeError } from 'serialize-error';
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
 * 消息id
 * @param clientId
 * @returns
 */
export function msgUUID(id: string) {
    return `${id}-${new Date().getTime()}-${uuid()}`;
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
 * 序列化错误对象
 * @param error
 */
export function stringifyError(error: Error | null | undefined) {
    if (!error) return null;
    return serializeError(error,{maxDepth:3})
}

/**
 * 解析错误对象
 * @param error 
 * @returns 
 */
export function parseError(error:any){
    if(!error) return null;
    return deserializeError(error)

}

/**
 * compose函数
 * @param middlewares
 * @returns
 */
export function compose(middlewares: Array<Function>) {
    return function (arg: any) {
        return dispatch(0);
        function dispatch(i: number) {
            let fn = middlewares[i];
            if (!fn) {
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
 * 解析消息体
 * @returns
 */
export function parseMessage(data: Buffer | unknown): SocketMessage[] {
    const messages = data && new Message(data);
    const msgs: SocketMessage[] = messages?.args;
    return msgs.filter((msg) => typeof msg === 'object' && msg.msgId);
}
