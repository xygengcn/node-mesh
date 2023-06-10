import { EmitterDebugLevel } from '@/emitter';
import pc from 'picocolors';

const typeColor = (type: EmitterDebugLevel) => {
    switch (type) {
        case 'debug': {
            return pc.gray;
        }
        case 'success':
            return pc.green;
        case 'warn':
            return pc.bgYellow;
        case 'error':
            return pc.red;
        default:
            return pc.white;
    }
};

/**
 * 打印日志
 * @param namespace
 * @param type
 * @param args
 */

export function consoleLog(namespace: string, type: EmitterDebugLevel, ...args: any) {
    const time = new Date();
    const formatTime = `${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}.${String(time.getMilliseconds()).padStart(3, '0')}`;
    console.log(`[%s] [%s] [%s]`, pc.yellow(formatTime), namespace, typeColor(type)(type), ...args);
}
