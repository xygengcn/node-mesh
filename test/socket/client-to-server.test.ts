import { Client, Server } from '@/index';

import assert from 'assert';

const server = new Server({ port: 3001, namespace: 'server1' });

// 测试相同的注册方法
server.response('action/test', (a, b) => {
    return a + b;
});

// 测试返回内容
server.response('action/add', (a, b) => {
    return a + b;
});

server.createSocket();

server.connect();

let client: Client;

describe('客户端和服务端的发消息测试', () => {
    after(() => {
        server.disconnect();
    });

    describe('客户端正常发送，服务端正常接收', () => {
        after(() => {
            client.disconnect();
        });
        it('服务端正确拿到客户端发送的数据', (done) => {
            client = new Client({ port: 3001, namespace: 'test-client-send' });

            client.$on('online', () => {
                client.request('action/message', [1, 1], () => {});
                server.$on('message', (message) => {
                    if (message.action === 'action/message') {
                        assert.equal(message.params[0], 1);
                        assert.equal(message.params[1], 1);
                        done();
                    }
                });
            });
            client.createSocket();
            client.connect();
        });
    });

    describe('客户端和服务端同时注册一个方法，客户端返回', () => {
        after(() => {
            client.disconnect();
        });
        it('返回结果 = test-client-request', (done) => {
            client = new Client({ port: 3001, namespace: 'test-client-request' });

            client.response('action/test', (a, b) => {
                return a + b + 1;
            });
            client.request('action/test', [1, 2], (error, result) => {
                assert.equal(result, 4);
                done(error);
            });
            client.createSocket();
            client.connect();
        });
    });

    describe('双向测试', () => {
        after(() => {
            client.disconnect();
        });
        it('客户端request，服务端response', (done) => {
            client = new Client({ port: 3001, namespace: 'test-server-response' });

            client.request('action/add', [1, 2], (error, result) => {
                assert.equal(result, 3);
                done(error);
            });
            client.createSocket();
            client.connect();
        });
    });
});
