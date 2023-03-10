import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';
import net from 'net';

const server = new ServerSocket({ port: 3000, serverId: 'server1' });

server.start();

server.on('error', (error) => {});

let index = 0;

describe('客户端和服务端的绑定测试', () => {
    after(() => {
        server.disconnect();
    });

    describe('测试客户端和服务端 正常情况', () => {
        it('client should be online', (done) => {
            const client = new ClientSocket({ port: 3000, host: '0.0.0.0', clientId: 'client-test-' + index++, targetId: 'server1' });
            client.connect();
            client.once('error', (e) => {
                client.off();
                client.disconnect();
            });
            client.once('online', () => {
                client.disconnect();
                client.off();
                done();
            });
        });
    });

    describe('测试客户端和服务端 密钥校验', () => {
        it('bind status should be 1', (done) => {
            server.configure({ secret: '1111' });
            const client = new ClientSocket({ port: 3000, host: '0.0.0.0', clientId: 'client-test-' + index++, targetId: 'server1', secret: '1111' });
            client.once('error', (e) => {
                client.off();
                client.disconnect();
            });
            client.connect();
            client.once('afterBind', (result) => {
                assert.equal(result.status, 1, '测试结果是：' + result.status);
                client.off();
                client.disconnect();
                done();
            });
        });
    });

    describe('测试客户端和服务端 服务器id错误情况', () => {
        it('bind status should be 2', (done) => {
            const client = new ClientSocket({ port: 3000, host: '0.0.0.0', clientId: 'client-test-' + index++, targetId: 'server1111' });
            client.connect();
            client.once('error', () => {
                client.disconnect();
                client.off();
                done();
            });
            client.once('afterBind', (result) => {
                assert.equal(result.status, 2);
                client.off();
                client.disconnect();
                done();
            });
        });
    });

    describe('测试客户端和服务端 密钥错误情况', () => {
        it('bind status should be 3', (done) => {
            server.configure({ secret: '1111' });
            const client = new ClientSocket({ port: 3000, host: '0.0.0.0', clientId: 'client-test-' + index++, targetId: 'server1', secret: '2222' });
            client.connect();
            client.once('error', () => {});
            client.once('afterBind', (result) => {
                assert.equal(result.status, 3);
                client.off();
                done();
            });
        });
    });

    describe('测试客户端和服务端 超时绑定，其他乱入绑定', () => {
        it('error code === 30016', (done) => {
            const socket = new net.Socket();
            socket.connect({ port: 3000, host: '0.0.0.0' });
            server.once('error', (error: any) => {
                assert.equal(error.code, 30016);
                done();
            });
        });
    });
});
