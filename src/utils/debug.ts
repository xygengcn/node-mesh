import colors from 'colors';

/**
 * 日志打印 白色
 * @param title
 * @param args
 */
export function debug(time: string, ns: string, title: string, ...args: any[]) {
    console.log(colors.gray(`[debug] ${time}`), colors.white(ns), colors.blue(title), ...args);
}

/**
 * 日志打印 蓝色
 * @param title
 * @param args
 */
export function log(time: string, ns: string, title: string, ...args: any[]) {
    console.log(colors.yellow(`[log] ${time}`), colors.white(ns), colors.blue(title), ...args);
}

/**
 * 成功打印 绿色
 * @param title
 * @param args
 */
export function success(time: string, ns: string, title: string, ...args: any[]) {
    console.log(colors.green(`[success] ${time}`), colors.white(ns), colors.blue(title), ...args);
}

/**
 * 警告打印 黄色
 * @param title
 * @param args
 */
export function warn(time: string, ns: string, title: string, ...args: any[]) {
    console.log(colors.bgYellow(`[warn] ${time}`), colors.white(ns), colors.blue(title), ...args);
}

/**
 * 错误打印 红色
 * @param title
 * @param args
 */
export function error(time: string, ns: string, title: string, ...args: any[]) {
    console.log(colors.bgRed(`[error] ${time}`), colors.white(ns), colors.blue(title), ...args);
}
