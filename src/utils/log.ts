import { EmitterDebugLevel } from '@/emitter';
import colors from 'picocolors';

const typeColor = (type: string) => {
    switch (type) {
        case 'debug':
            return colors.gray;
        case 'log':
            return colors.yellow;
        case 'success':
            return colors.green;
        case 'warn':
            return colors.bgYellow;
        case 'error':
            return colors.red;
        default:
            return colors.white;
    }
};

/**
 * 打印日志
 * @param namespace
 * @param type
 * @param args
 */

export function consoleLog(namespace: string, type: EmitterDebugLevel, ...args: any) {
    const date = new Date();
    console.log(
        `%s %s (%s) `,
        date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) + '.' + date.getMilliseconds(),
        typeColor(type)(type.toUpperCase()),
        namespace,
        ...args
    );
}
