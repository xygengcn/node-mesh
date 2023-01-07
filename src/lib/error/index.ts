interface BaseErrorOptions extends Error {
    code: number | string;
    stack?: any;
}
/**
 * 基础错误
 */
export default class BaseError extends Error {
    // 错误代码
    public code!: number | string;

    // 原始错误
    public error!: Error | null;

    // 构造函数
    constructor(code: string | number, error: Error | null | string) {
        super(typeof error === 'string' ? error : error?.message, { cause: typeof error !== 'string' && error?.cause });
        if (error instanceof Error && (error as any).code) {
            code = (error as any).code;
        }
        Object.assign(this, { code, error });
    }

    // 转换成数据
    public toJson(): BaseErrorOptions | null {
        if (!this.error) {
            return null;
        }
        return {
            code: this.code,
            stack: this.stack,
            name: this.name,
            cause: this.cause,
            message: this.message
        };
    }
}
