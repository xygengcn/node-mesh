import { Client, Server } from '@/index';
import assert from 'assert';

const server = new Server({ port: 3003, namespace: 'server1' });

server.$on('error', (error) => {
    console.log('[server-error]', error);
});

server.response('action/server-error', () => {
    return Promise.reject({ code: 'code' });
});

// 注册跟客户端相同
server.response('action/client-error', () => {
    return true;
});

server.createSocket();
server.connect();

let client: Client;

describe('客户端和服务端的发消息错误测试', () => {
    after(() => {
        server.disconnect();
    });
    afterEach(() => {
        client.disconnect();
    });

    describe('客户端错误自己返回测试', () => {
        it('客户端request，自己response', (done) => {
            client = new Client({ port: 3003, namespace: 'client1' });
            client.response('action/client-error', () => {
                return Promise.reject({ code: 222 });
            });
            client.createSocket();
            client.connect();
            client.request('action/client-error', [], (error: any, result) => {
                assert.equal(error?.code, 222);
                done(result);
            });
        });
    });

    describe('服务端错误返回测试', () => {
        it('客户端request，服务端response', (done) => {
            client = new Client({ port: 3003, namespace: 'client2' });
            client.createSocket();
            client.connect();
            client.request('action/server-error', ['123456789'], (error: any, result) => {
                assert.equal(error?.code, 'code');
                done(result);
            });
        });
    });
});
