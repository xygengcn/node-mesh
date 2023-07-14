export enum CustomErrorCode {
    success = "OK", // 成功
    none = "NONE", // 未知
    requestTimeout = "REQUEST_TIMEOUT", // 请求超时
    bindError = "BIND_ERROR", // 绑定失败
    requestParamsError = "REQUEST_PARAM_ERROR", // 请求参数问题
    bindTimeout = "BIND_TIMEOUT", // 绑定超时
    actionNotExist = "ACTION_NOT_EXIST", // 动作不存在
    actionSocketNotActive = "ACTION_SOCKET_NOT_ACTIVE" // socket不在线或者不存在
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
