import { Client, Server } from '@/index';
import assert from 'assert';

const server = new Server({ port: 3006, namespace: 'server1' });

server.createSocket();
server.connect();

server.$on('error', (error) => {
    console.log('[server-error]', error);
});

// 服务端注册
server.response('action/test', () => {
    return 'server1';
});

const client = new Client({ port: 3006, host: '0.0.0.0', namespace: 'client1' });

describe('插件测试', () => {
    after(() => {
        client.disconnect();
        server.disconnect();
    });

    describe('测试执行顺序问题', () => {
        it('先注册先执行', (done) => {
            let i = 0;

            // 第三次执行

            client.use((ctx, next) => {
                assert.equal(i, 2);
                i++;
            });

            // 第二次执行
            client.use((ctx, next) => {
                assert.equal(i, 1);
                i++;
                next();
                assert.equal(i, 3);
                i++;
            });

            client.use((ctx, next) => {
                // 先执行
                assert.equal(i, 0);
                i++;
                next();
                assert.equal(i, 4);
                done();
            });
            client.createSocket();
            client.connect();
        });
    });
});
