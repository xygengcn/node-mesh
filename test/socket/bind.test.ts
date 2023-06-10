import assert from 'assert';
import Server from '@/lib/server';
import { describe, it } from 'mocha';
import Client from '@/lib/client';
import { CustomErrorCode } from '@/error';
import net from 'net';

/**
 * 客户端和服务端绑定测试
 */

const server = new Server({ port: 4002, namespace: 'server1' });

let client;

server.createSocket();
server.connect();

let index = 0;

describe('客户端和服务端的绑定测试', () => {
    beforeEach(() => {
        client = new Client({ port: 4002, namespace: 'client' + index++ });
    });

    afterEach(async () => {
        await client?.disconnect();
    });

    it('测试客户端和服务端 正常无密钥情况', (done) => {
        client.$once('error', (e) => {
            done(e);
        });
        client.$once('online', () => {
            done();
        });
        client.createSocket();
        client.connect();
    });

    it('测试客户端和服务端 密钥成功校验', (done) => {
        server.configure({ auth: 'auth' });
        client.configure({ auth: 'auth' });
        client.$once('error', (e) => {
            done(e);
        });
        client.$once('online', () => {
            done();
        });
        client.createSocket();
        client.connect();
    });

    it('测试客户端和服务端 密钥错误情况', (done) => {
        server.configure({ auth: 'auth2' });
        client.configure({ auth: 'auth' });
        client.$once('error', (e: any) => {
            assert.equal(e.code, CustomErrorCode.bindError);
            done();
            client?.disconnect();
        });

        client.$once('online', () => {
            done(Error());
        });
        client.createSocket();
        client.connect();
    });
});

describe('测试客户端和服务端 超时绑定，其他乱入绑定', () => {
    after(() => {
        server.disconnect();
    });
    it('抛出错误', (done) => {
        const client1 = new net.Socket();
        server.$once('error', (error: any) => {
            assert.equal(error.code, CustomErrorCode.bindTimeout);
        });
        client1.on('end', (e) => {
            done(e);
        });
        client1.on('error', (e) => {
            done(e);
        });
        client1.connect(4002, '127.0.0.1');
    });
});
