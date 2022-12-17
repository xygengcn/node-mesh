import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3003, host: '0.0.0.0', serverId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

server.response('action/error', () => {
    return Promise.reject(Error('测试数据'));
});

describe('客户端和服务端的发消息错误测试', () => {
    after(() => {
        server.stop();
    });

    describe('服务端错误返回测试', () => {
        it('客户端request，服务端response, 测试callback', (done) => {
            const client = new ClientSocket({ port: 3003, host: '0.0.0.0', id: 'test-server-response-callback', targetId: 'server1' });
            client.connect();
            client.on('online', () => {
                client.request('action/error', {}, (error, body) => {
                    assert.equal(error instanceof Error, true);
                    client.disconnect();
                    done();
                });
            });
        });
        it('客户端request，服务端response, 测试promise', (done) => {
            const client = new ClientSocket({ port: 3003, host: '0.0.0.0', id: 'test-server-response-promise', targetId: 'server1' });
            client.connect();
            client.on('online', () => {
                client.request('action/error', '123456789').catch((e) => {
                    assert.ok(true);
                    client.disconnect();
                    done();
                });
            });
        });
    });
});
