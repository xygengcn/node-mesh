import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3001, serverId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

// 测试相同的注册方法
server.response('action/test', () => {
    return 'server1';
});

// 测试返回内容
server.response('action/add', (parmas) => {
    return parmas + '0';
});

describe('客户端和服务端的发消息测试', () => {
    after(() => {
        server.stop();
    });

    describe('客户端正常发送，服务端正常接收', () => {
        it('服务端正确拿到客户端发送的数据', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', clientId: 'test-client-send', targetId: 'server1' });
            client.connect();
            client.on('online', () => {
                client.request('action/message', 'hello');
                server.once('message', (message) => {
                    assert.equal(message.content.content, 'hello');
                    client.disconnect();
                    done();
                });
            });
        });
    });

    describe('客户端和服务端同时注册一个方法，客户端返回', () => {
        it('返回结果 = test-client-request', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', clientId: 'test-client-request', targetId: 'server1' });
            client.response('action/test', (content) => {
                return content + 'test-client-request';
            });
            client.connect();
            client.on('online', () => {
                client.request('action/test', 'hello word，').then((result) => {
                    assert.equal(result, 'hello word，test-client-request');
                    client.disconnect();
                    done();
                });
            });
        });
    });

    describe('双向测试', () => {
        it('客户端request，服务端response, 测试callback', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', clientId: 'test-server-response-callback', targetId: 'server1' });
            client.connect();
            client.on('online', () => {
                client.request('action/add', '123456789', (error, body) => {
                    assert.equal(body, '1234567890');
                    client.disconnect();
                    done();
                });
            });
        });
        it('客户端request，服务端response, 测试promise', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', clientId: 'test-server-response-promise', targetId: 'server1' });
            client.connect();
            client.on('online', () => {
                client.request('action/add', '123456789').then((result) => {
                    assert.equal(result, '1234567890');
                    client.disconnect();
                    done();
                });
            });
        });
    });
});
