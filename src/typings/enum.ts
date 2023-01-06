/**
 * 客户端和服务端的绑定状态
 */
export enum SocketBindStatus {
    waiting = 0,
    error = 2, // 服务器id失败
    authError = 3, // 验证secret失败
    success = 1
}

/**
 * 通信者身份
 */
export enum SocketType {
    client = 'client',
    server = 'server'
}
