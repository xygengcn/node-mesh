import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3009, serverId: 'server1' });
const client1 = new ClientSocket({ port: 3009, host: '0.0.0.0', clientId: 'client1', targetId: 'server1' });
const client2 = new ClientSocket({ port: 3009, host: '0.0.0.0', clientId: 'client2', targetId: 'server1' });
const client3 = new ClientSocket({ port: 3009, host: '0.0.0.0', clientId: 'client3', targetId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

describe('客户端和服务端的发布订阅测试', () => {
    after(() => {
        server.disconnect();
    });

    describe('订阅与发布', () => {
        it('服务端发布,客户端订阅', (done) => {
            let index = 0;
            let doneFnc = () => {
                index++;
                if (index === 2) {
                    done();
                    client3.off('subscribe');
                    server.off('subscribe');
                    client1.unsubscribe('sub/test');
                    client2.unsubscribe('sub/test');
                }
            };
            client1.subscribe('sub/test', (e, content) => {
                assert.equal(content, 'sub1');
                doneFnc();
            });
            client2.subscribe('sub/test', (e, content) => {
                assert.equal(content, 'sub1');
                doneFnc();
            });
            client3.on('subscribe', () => {
                assert.fail('不订阅也收到了');
            });
            server.on('subscribe', () => {
                assert.fail('不订阅也收到了');
            });
            let onlineIndex = 0;
            server.on('sysMessage', (content) => {
                if (content.event === 'socket:online') {
                    onlineIndex++;
                    if (onlineIndex === 2) {
                        server.publish('sub/test', 'sub1');
                    }
                }
            });
            client1.connect();
            client2.connect();
            client3.connect();
        });

        it('客户端1发布,服务端订阅,其他端收不到', (done) => {
            client1.once('subscribe', () => {
                assert.fail('不订阅也收到了');
            });
            client2.once('subscribe', () => {
                assert.fail('不订阅也收到了');
            });
            client3.once('subscribe', () => {
                assert.fail('不订阅也收到了');
            });
            server.subscribe('sub/test', (e, content) => {
                assert.equal(content, 'sub2');
                done();
                client1.off('subscribe');
                client2.off('subscribe');
                client3.off('subscribe');
                server.unsubscribe('sub/test');
            });
            client1.publish('sub/test', 'sub2');
        });

        it('客户端1发布,客户端2订阅，其他收不到', (done) => {
            client1.once('subscribe', () => {
                assert.fail('不订阅也收到了');
            });
            client2.once('subscribe', () => {
                assert.fail('不订阅也收到了');
            });
            server.once('subscribe', () => {
                assert.fail('不订阅也收到了');
            });
            // 后订阅
            client3.subscribe('sub/test', (e, content) => {
                assert.equal(content, 'sub3');
                done();
                client1.off('subscribe');
                client2.off('subscribe');
                server.off('subscribe');
                client3.unsubscribe('sub/test');
            });
            client1.publish('sub/test', 'sub3');
        });
    });
});
