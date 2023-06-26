import { Message } from '@/lib/message';
import Socket from '@/lib/socket';
import { pack } from 'msgpackr-node';
import Queue from '@/utils/queue';

export interface ISenderOptions {
    // 最多压缩多少条消息发送
    messageLimit?: number;
    // 并发write
    sendConcurrency?: number;
}
/**
 * 发送者
 */
export default class Sender {
    /**
     * socket
     */
    public socket!: Socket;

    /**
     * 配置
     */
    public options: ISenderOptions;

    /**
     * 队列
     */
    public sendMessageQueue: Queue;

    constructor(options: ISenderOptions, socket: Socket) {
        this.options = options;
        // 重新定义
        this.socket = socket;

        // 队列
        this.sendMessageQueue = new Queue({ concurrency: this.options.sendConcurrency || 100 });
    }

    /**
     * 发送消息队列
     *
     * 1、请求的时候
     *
     * @param args
     */
    public send(...msgs: Message[]) {
        if (msgs.length <= 0) return Promise.resolve([]);
        if (this.socket.readyState !== 'open') return Promise.resolve(msgs);
        while (msgs.length > 0) {
            // 最多一次发送50条消息
            const messages = msgs.splice(0, this.options.messageLimit || 50);
            this.sendMessageQueue.add(() => this.write(messages));
        }
    }

    /**
     * 消息写入
     * @param messages
     * @returns
     */
    private write(messages: Message[]) {
        const iMessages = messages.map((message) => {
            // 设置发送者和接收者
            message.setTarget(this.socket.remoteId());
            message.setFrom(this.socket.localId());
            message.setFromName(this.socket.name);
            return message.toRaw();
        });
        // 发送消息
        this.socket.$emit('send', iMessages);
        return new Promise((resolve, reject) => {
            const buf = pack(iMessages);
            this.socket.$write(buf, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve([]);
            });
        });
    }

    /**
     * 销毁
     *
     * 1、客户端的disconnect
     *
     * 2、服务端的connection close事件
     */
    public $destroy() {
        if (this.socket) {
            return this.socket?.$end();
        }
        return Promise.resolve();
    }
}
