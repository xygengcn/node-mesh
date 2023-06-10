import CustomError, { CustomErrorCode } from '@/error';
import net, { AddressInfo } from 'net';
import { IMessage, Message, isMessage } from '../message';
import { PackrStream, UnpackrStream } from 'msgpackr-node';
import { unpackBufToMessage } from '@/utils';
/**
 * socket自定义事件
 */
export type SocketEvents = {
    online: () => void;
    // 发送消息
    send: (messages: IMessage[]) => void;
    // 来消息了
    message: (message: Message) => void;
    // 状态更新
    status: (status: SocketStatus) => void;
    // 客户端下线
    offline: () => void;

    // 原生事件
    close: (hadError: boolean) => void;
    connect: () => void;
    data: (data: Buffer) => void;
    drain: () => void;
    end: () => void;
    error: (err: Error) => void;
    lookup: (err: Error, address: string, family: string | number, host: string) => void;
    ready: () => void;
    timeout: () => void;
};

/**
 * 客户端状态
 */
export enum SocketStatus {
    none = 'none', // 默认状态
    pending = 'pending', // 等待链接
    connected = 'connected', // 已经连接，未绑定
    binding = 'binding', // 等待绑定回复
    online = 'online', // 在线
    offline = 'offline', // 离线
    retrying = 'retrying' // 重新连接
}
export default class Socket extends net.Socket {
    /**
     * 绑定计时，链接后操作2s中不绑定则断开
     */
    private bindSetTimeout!: NodeJS.Timeout | null;

    /**
     * 状态
     */
    public readonly status: SocketStatus = SocketStatus.none;

    /**
     * 写入流
     */
    private writeStream: PackrStream = new PackrStream();

    /**
     * 读取流
     */
    private readStream: UnpackrStream = new UnpackrStream();

    constructor() {
        super();
        this.writeStream.pipe(this);
        this.createReadStream();
    }

    /**
     * 绑定
     */
    private createReadStream() {
        if (this.readStream) {
            this.readStream.removeAllListeners();
            this.readStream.destroy();
        }
        this.readStream = new UnpackrStream();
        this.readStream.on('data', (buf: Buffer) => {
            const messages: IMessage[] = unpackBufToMessage(buf);
            if (messages && Array.isArray(messages)) {
                messages.forEach((msg) => {
                    if (isMessage(msg)) {
                        const message = new Message(msg);
                        // 统一触发事件
                        this.$emit('message', message);
                    }
                });
            }
        });
        this.pipe(this.readStream);
    }

    /**
     * 写入
     * @param buffer
     * @param cb
     * @returns
     */
    public $write(buffer: Buffer, cb?: (err?: Error) => void): boolean {
        return this.writeStream.write(buffer, cb);
    }

    /**
     * 设置绑定定时，超时绑定警告
     */
    public setBindTimeout() {
        if (this.bindSetTimeout) {
            clearTimeout(this.bindSetTimeout);
        }
        // 开始计时
        this.bindSetTimeout = setTimeout(() => {
            this.$emit('error', new CustomError(CustomErrorCode.bindTimeout, this.remoteId()));
            this.$end(true);
        }, 2000);
    }

    /**
     * 清除计时
     */
    public clearBindSetTimeout() {
        if (this.bindSetTimeout) {
            clearTimeout(this.bindSetTimeout);
        }
        this.bindSetTimeout = null;
    }

    /**
     * 复制socket
     * @param socket
     */
    public assign(socket: net.Socket) {
        Object.assign(this, socket);
        this.createReadStream();
    }

    /**
     * 更新状态
     */
    public updateStatus(status) {
        Reflect.set(this, 'status', status);
        this.$emit('status', this.status);
    }

    /**
     * 事件触发
     * @param event
     * @param args
     * @returns
     */
    public $emit<T extends keyof SocketEvents>(e: T, ...args: Parameters<SocketEvents[T]>): boolean {
        return super.emit(e, ...args);
    }

    /**
     * 事件监听
     * @param event
     * @param args
     * @returns
     */
    public $on<T extends keyof SocketEvents>(e: T, callback: SocketEvents[T]) {
        return super.on(e, callback);
    }

    /**
     * 事件监听
     * @param event
     * @param args
     * @returns
     */
    public $once<T extends keyof SocketEvents>(e: T, callback: SocketEvents[T]) {
        return super.once(e, callback);
    }

    /**
     * 获取socketId
     * @returns
     */
    public remoteId(): string {
        if (!this.remoteAddress || !this.remotePort) return '';
        return `${this.remoteFamily || 'IPv4'}://${this.remoteAddress}:${this.remotePort}`;
    }

    /**
     * 本地地址
     * @returns
     */
    public localId(): string {
        const addressInfo = this.address() as AddressInfo;
        return `${addressInfo.family || 'IPv4'}://${addressInfo.address}:${addressInfo.port}`;
    }
    /**
     * 断开链接
     */
    // 服务端销毁客户端
    // [server] [warn] [client-offline] IPv4://127.0.0.1:50090 offline
    // [client] [warn] [end]
    // [client] [warn] [disconnect] true
    // [client] [debug] [clearReconnetTimeout]
    // [client] [debug] [ended]
    // [client] [debug] [reconnect]
    // [server] [warn] [client-end] IPv4://127.0.0.1:58090
    // [server] [warn] [client-close] IPv4://127.0.0.1:58090

    // 客户端断开
    // [client] [warn] [disconnect] false
    // [client] [debug] [clearReconnetTimeout]
    // [client] [debug] [ended]
    // [server] [warn] [client-end] IPv4://127.0.0.1:57455
    // [server] [warn] [client-offline] IPv4://127.0.0.1:57455 offline
    // [server] [warn] [client-close] IPv4://127.0.0.1:57455

    public $end(unref: boolean = true) {
        if (this.status !== SocketStatus.offline) {
            // 清除绑定定时器
            this.clearBindSetTimeout();

            this.readStream.removeAllListeners();
            this.readStream.destroy();

            this.writeStream.removeAllListeners();
            this.writeStream.destroy();

            return new Promise((resolve) => {
                // 结束连接
                this.end(() => {
                    // 更新状态
                    this.updateStatus(SocketStatus.offline);
                    this.$emit('offline');

                    // 清除监听
                    this.removeAllListeners();
                    // 移除所有连接
                    unref && this.unref();
                    resolve(this.status);
                });
            });
        }
        return Promise.resolve();
    }
}
