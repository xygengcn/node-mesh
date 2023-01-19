import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3001, serverId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

// 测试相同的注册方法
server.response('action/test', (a, b) => {
    return a + b;
});

// 测试返回内容
server.response('action/add', (a, b) => {
    return a + b;
});

describe('客户端和服务端的发消息测试', () => {
    after(() => {
        server.disconnect();
    });

    describe('客户端正常发送，服务端正常接收', () => {
        it('服务端正确拿到客户端发送的数据', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', clientId: 'test-client-send', targetId: 'server1' });
            client.connect();
            client.on('online', () => {
                client.request('action/message', 1, 1);
                server.once('message', (message) => {
                    assert.equal(message.content.content[0], 1);
                    assert.equal(message.content.content[1], 1);
                    client.disconnect();
                    done();
                });
            });
        });
    });

    describe('客户端和服务端同时注册一个方法，客户端返回', () => {
        it('返回结果 = test-client-request', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', clientId: 'test-client-request', targetId: 'server1' });
            client.response('action/test', (a, b) => {
                return a + b + 1;
            });
            client.connect();
            client.on('online', () => {
                client.request('action/test', 1, 2).then((result) => {
                    assert.equal(result, 4);
                    client.disconnect();
                    done();
                });
            });
        });
    });

    describe('双向测试', () => {
        it('客户端request，服务端response, 测试promise', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', clientId: 'test-server-response-promise', targetId: 'server1' });
            client.connect();
            client.on('online', () => {
                client.request('action/add', 1, 2).then((result) => {
                    assert.equal(result, 3);
                    client.disconnect();
                    done();
                });
            });
        });
    });
});
