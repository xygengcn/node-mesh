import { CustomErrorCode } from '@/error';
import Client from '@/lib/client';
import Server from '@/lib/server';

import assert from 'assert';

const server = new Server({ port: 3004, namespace: 'server1' });

server.createSocket();
server.connect();

server.$on('error', (error) => {
    console.log('[server-error]', error);
});

// 服务端注册
server.response('action/test', (a, b) => {
    return a + b + 'server1';
});

const client: Client = new Client({ port: 3004, host: '0.0.0.0', namespace: 'client1' });
// 客户端注册
client.response('action/test', (params) => {
    assert.equal(params, 'hello');
    return 'client1';
});

// 客户端注册
client.response('client/response', (a, b) => {
    assert.equal(a, 'hello');
    assert.equal(b, 'client2');
    return 'client2';
});

client.createSocket();
client.connect();

describe('服务端请求客户端测试', () => {
    after(() => {
        server.disconnect();
        client.disconnect();
    });

    it('服务端、客户端同时注册，服务端返回', (done) => {
        // 服务端请求
        server.request('action/test', ['hello', 'world'], (error, result) => {
            assert.equal(result, 'helloworldserver1');
            done(error);
        });
    });
    it('客户端注册，服务端请求，客户端返回', (done) => {
        // 服务端请求
        server.request('client/response', ['hello', 'client2'], (error, result) => {
            assert.equal(result, 'client2');
            done();
        });
    });
    it('客户端注册，客户端离线，服务端请求，请求失败', (done) => {
        client.disconnect();
        server.$once('clientOffline', () => {
            server.request('client/response', ['hello'], (e: any) => {
                assert.equal(e.code, CustomErrorCode.actionSocketNotActive);
                done();
            });
        });
    });
});
