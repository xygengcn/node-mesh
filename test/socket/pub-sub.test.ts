import { Client, Server } from '@/index';
import { MessageSysAction } from '@/lib/message';
import assert from 'assert';
import { doneTimes } from 'test/utils';

/**
 * 订阅测试
 */

const server = new Server({ port: 3009, namespace: 'server1' });
const client1 = new Client({ port: 3009, host: '0.0.0.0', namespace: 'client1' });
const client2 = new Client({ port: 3009, host: '0.0.0.0', namespace: 'client2' });
const client3 = new Client({ port: 3009, host: '0.0.0.0', namespace: 'client3' });

server.createSocket();
server.connect();

client1.createSocket();
client1.connect();
client2.createSocket();
client2.connect();
client3.createSocket();
client3.connect();

server.$on('error', (error) => {
    console.log('[server-error]', error);
});

describe('客户端和服务端的发布订阅测试', () => {
    after(() => {
        server.disconnect();
        client1.disconnect();
        client2.disconnect();
        client3.disconnect();
    });
    beforeEach(() => {
        server.$off('subscribe');
        client1.$off('subscribe');
        client2.$off('subscribe');
        client3.$off('subscribe');
    });
    it('服务端发布,客户端订阅', (done) => {
        const done2 = doneTimes(2, done);
        const sub = doneTimes(2, () => {
            server.publish('sub/test', 'sub1');
        });
        client1.subscribe('sub/test', (content) => {
            assert.equal(content, 'sub1');
            done2();
        });
        client2.subscribe('sub/test', (content) => {
            assert.equal(content, 'sub1');
            done2();
        });
        client3.$once('subscribe', () => {
            assert.fail('不订阅也收到了');
        });
        server.$once('subscribe', () => {
            assert.fail('不订阅也收到了');
        });
        server.$on('notification', (message) => {
            if (message.action === MessageSysAction.register) {
                sub();
            }
        });
    });

    it('客户端1发布,服务端订阅,其他端收不到', (done) => {
        client1.$once('subscribe', () => {
            assert.fail('不订阅也收到了');
        });
        client2.$once('subscribe', () => {
            assert.fail('不订阅也收到了');
        });
        client3.$once('subscribe', () => {
            assert.fail('不订阅也收到了');
        });
        server.subscribe('sub/test2', (content) => {
            assert.equal(content, 'sub2');
            done();
        });
        client1.publish('sub/test2', 'sub2');
    });

    it('客户端1发布,客户端2订阅，其他收不到', (done) => {
        client1.$once('subscribe', () => {
            assert.fail('不订阅也收到了');
        });
        client2.$once('subscribe', () => {
            assert.fail('不订阅也收到了');
        });
        server.$once('subscribe', () => {
            assert.fail('不订阅也收到了');
        });
        // 后订阅
        client3.subscribe('sub/test3', (content) => {
            assert.equal(content, 'sub3');
            done();
        });
        server.$on('notification', (message) => {
            if (message.action === MessageSysAction.register) {
                client1.publish('sub/test3', 'sub3');
            }
        });
    });

    it('服务端发布，服务端订阅，其他收不到', (done) => {
        client1.$once('subscribe', () => {
            done('不订阅也收到了');
        });
        client2.$once('subscribe', () => {
            done('不订阅也收到了');
        });
        client3.$once('subscribe', () => {
            done('不订阅也收到了');
        });
        // 后端订阅
        server.subscribe('sub/test4', (content) => {
            assert.equal(content, 'sub4');
            done();
        });
        server.publish('sub/test4', 'sub4');
    });
});
