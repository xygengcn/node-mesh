export enum CustomErrorCode {
    success = 0, // 成功
    none = 1, // 未知
    requestTimeout = 2, // 请求超时
    bindError = 3, // 绑定失败
    requestParamsError = 4, // 请求参数问题
    bindTimeout = 5, // 绑定超时
    actionNotExist = 6, // 动作不存在
    actionSocketNotActive = 7 // socket不在线或者不存在
}

/**
 * 通用错误
 */
export default class CustomError extends Error {
    /**
     * 错误码
     */
    public code: CustomErrorCode;
    constructor(code: CustomErrorCode, message: string = '') {
        super(message);
        this.code = code;
    }
}
