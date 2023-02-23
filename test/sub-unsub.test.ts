import { SocketCallback } from '@/typings/socket';
import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3010, serverId: 'server1' });
const client1 = new ClientSocket({ port: 3010, host: '0.0.0.0', clientId: 'client1', targetId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

describe('客户端和服务端的发布订阅测试', () => {
    after(() => {
        server.disconnect();
        client1.disconnect();
    });

    describe('客户端取消订阅', () => {
        it('客户端订阅两次，取消一个，不影响另一个', (done) => {
            client1.subscribe('sub/test', (error, data) => {
                if (data === 'sub2') {
                    done();
                }
            });
            let cb: SocketCallback | null = (error, data) => {
                assert.equal(data, 'sub1');
                cb && client1.unsubscribe('sub/test', cb);
                cb = null;
                client1.publish('sub/test', 'sub2');
            };
            cb && client1.subscribe('sub/test', cb);
            client1.publish('sub/test', 'sub1');
        });
    });
});
