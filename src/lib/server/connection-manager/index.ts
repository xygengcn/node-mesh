import Socket, { SocketStatus } from '@/lib/socket';
import Connection from './connection';
import { type Transport } from '@/lib/transport';
import { Message } from '@/lib/message';
import { isFunction } from '@/utils';
import ArraySet from '@/utils/set';

/**
 * 服务端连接管理
 */
export default class ConnectionManager {
    // id 对应 连接
    public idBindConnectionManager: Map<string, Connection> = new Map();

    // 名字绑定id
    public nameBindIdManager: Map<string, string> = new Map();

    // 订阅绑定
    public subscribeBindIdManager: Map<string, ArraySet<string>> = new Map();

    // 创建连接
    public createConnection(socket: Socket, transport: Transport) {
        const id = socket.remoteId();
        if (this.idBindConnectionManager.has(id)) {
            const oldConnection = this.idBindConnectionManager.get(id);
            oldConnection?.close();
        }
        const connection = new Connection(id, socket, transport);
        this.idBindConnectionManager.set(id, connection);
        return connection;
    }

    // 连接数量
    public get count() {
        return this.idBindConnectionManager.size;
    }

    // 通过id寻找
    public findConnectionById(id: string): Connection | undefined {
        return this.idBindConnectionManager.get(id);
    }

    // 通过name寻找
    public findConnectionByName(name: string): Connection | undefined {
        const id = this.nameBindIdManager.get(name);
        return id ? this.idBindConnectionManager.get(id) : undefined;
    }

    /**
     * 通过key寻找
     * @param name
     * @returns
     */
    public findConnectionIdsBySubscribe(name: string): Array<string> {
        return this.subscribeBindIdManager.get(name)?.toArray() || [];
    }

    /**
     * 查找连接
     * @param callback
     * @returns
     */
    public findConnect<T>(callback: (connection: Connection) => T): T[] {
        const result = [];
        if (isFunction(callback)) {
            this.idBindConnectionManager.forEach((connection) => {
                result.push(callback(connection));
            });
        }
        return result;
    }

    /**
     * 广播消息
     * @param ids
     * @param message
     */
    public broadcast(message: Message, ids?: string[] | ((connection: Connection) => boolean), filter?: string[]) {
        // 传入id
        if (ids) {
            if (Array.isArray(ids)) {
                ids.forEach((id) => {
                    if (filter?.includes(id)) {
                        return;
                    }
                    const connection = this.findConnectionById(id);
                    connection?.transport.send(message);
                });
                return;
            }
            // 回调函数
            if (isFunction(ids)) {
                this.idBindConnectionManager.forEach((connection) => {
                    if (ids(connection)) {
                        connection.transport.send(message);
                    }
                });
            }
        } else {
            // 全局广播
            this.idBindConnectionManager.forEach((connection) => {
                connection.transport.send(message);
            });
        }
    }

    /**
     *  订阅绑定
     * @param sub
     * @param remoteId
     */
    public bindSubscribe(sub: string, remoteId: string) {
        if (this.idBindConnectionManager.has(remoteId)) {
            const idSet = this.subscribeBindIdManager.get(sub) || new ArraySet();
            idSet.add(remoteId);
            this.subscribeBindIdManager.set(sub, idSet);
        }
    }

    /**
     *  订阅取消绑定
     * @param sub
     * @param remoteId
     */
    public unBindSubscribe(remoteId: string) {
        const connection = this.findConnectionById(remoteId);
        const subscribeNames = connection?.transport.subscriber.toSubscribeEvents();
        if (subscribeNames.length) {
            subscribeNames.forEach((key) => {
                const sub = this.subscribeBindIdManager.get(key);
                sub?.delete(remoteId);
            });
        }
    }

    /**
     * 所有链接
     * @returns
     */
    public connections(): Array<{ id: string; name: string; status: SocketStatus }> {
        const connections = [];
        this.idBindConnectionManager.forEach((connection, id) => {
            connections.push({
                id,
                name: connection.name,
                status: connection.status
            });
        });
        return connections;
    }

    /**
     * 绑定名字
     * @param name
     * @param id
     */
    public bindName(name: string, id: string) {
        if (this.idBindConnectionManager.has(id)) {
            this.nameBindIdManager.set(name, id);
            const connection = this.idBindConnectionManager.get(id);
            connection.bindName(name);
        }
    }

    /**
     * 下线用户
     * @param remoteId
     */
    public async offline(remoteId: string) {
        const connection = this.findConnectionById(remoteId);
        // 移除订阅绑定
        this.subscribeBindIdManager.forEach((sub) => {
            sub.delete(remoteId);
        });
        // 关闭连接
        if (connection) {
            await connection.close();
        }
        this.idBindConnectionManager.delete(remoteId);
    }

    /**
     * 销毁所有客户端
     *
     * @param remoteId
     * @returns
     */
    public end(remoteId?: string) {
        // 只销毁一个
        if (remoteId) {
            this.offline(remoteId);
            return;
        }

        // 关闭所有连接
        this.idBindConnectionManager.forEach((connection) => {
            connection.close();
        });
        // 清掉绑定
        this.idBindConnectionManager.clear();
        // 清掉名字绑定
        this.nameBindIdManager.clear();
        // 清理订阅绑定
        this.subscribeBindIdManager.clear();
    }
}
