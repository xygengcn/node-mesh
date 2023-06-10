import Client from '@/lib/client';
import Server from '@/lib/server';
import assert from 'assert';
import { doneTimes } from 'test/utils';

const server = new Server({ port: 3007, namespace: 'server1' });
const client1 = new Client({ port: 3007, host: '0.0.0.0', namespace: 'client1' });
const client2 = new Client({ port: 3007, host: '0.0.0.0', namespace: 'client2' });
const client3 = new Client({ port: 3007, host: '0.0.0.0', namespace: 'client3' });

server.createSocket();
server.connect();

server.$on('error', (error) => {
    console.log('[server-error]', error);
});

describe('广播测试', () => {
    after(() => {
        server.disconnect();
        client1.disconnect();
        client2.disconnect();
        client3.disconnect();
    });

    describe('客户端广播', () => {
        afterEach(() => {
            server.$off('notification');
            client1.$off('notification');
            client2.$off('notification');
            client3.$off('notification');
        });
        it('客户端1广播，客户端2，3和服务端收到广播，内容相同', (done) => {
            const broadcast = doneTimes(3, () => {
                client1.broadcast('broadcast-test', 'broadcast-test-param');
            });
            server.$on('clientOnline', () => {
                broadcast();
            });
            const done3 = doneTimes(3, done);
            client1.$on('notification', () => {
                assert.fail(Error('不可监听'));
            });
            client2.$on('notification', (message) => {
                if (message.action === 'broadcast-test' && message.params[0] === 'broadcast-test-param') {
                    done3();
                }
            });
            client3.$on('notification', (message) => {
                if (message.action === 'broadcast-test' && message.params[0] === 'broadcast-test-param') {
                    done3();
                }
            });
            server.$on('notification', (message) => {
                if (message.action === 'broadcast-test' && message.params[0] === 'broadcast-test-param') {
                    done3();
                }
            });
            client1.createSocket();
            client1.connect();
            client2.createSocket();
            client2.connect();
            client3.createSocket();
            client3.connect();
        });

        it('服务端广播，客户端收到', (done) => {
            const done3 = doneTimes(3, done);
            client1.$on('notification', (message) => {
                if (message.action === 'broadcast-test' && message.params[0] === 'broadcast-test-param') {
                    done3();
                }
            });
            client2.$on('notification', (message) => {
                if (message.action === 'broadcast-test' && message.params[0] === 'broadcast-test-param') {
                    done3();
                }
            });
            client3.$on('notification', (message) => {
                if (message.action === 'broadcast-test' && message.params[0] === 'broadcast-test-param') {
                    done3();
                }
            });
            server.$on('notification', () => {
                assert.fail(Error('不可监听'));
            });

            server.broadcast('broadcast-test', 'broadcast-test-param');
        });
    });
});
