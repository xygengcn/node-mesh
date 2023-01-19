import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3006, serverId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

// 服务端注册
server.response('action/test', () => {
    return 'server1';
});

const client = new ClientSocket({ port: 3006, host: '0.0.0.0', clientId: 'client1', targetId: 'server1' });

describe('插件测试', () => {
    after(() => {
        client.disconnect();
        server.disconnect();
    });

    describe('测试执行顺序问题', () => {
        it('后注册先执行', (done) => {
            let i = 0;

            client.use('data', (ctx, next) => {
                i++;
                next();
            });

            client.use('data', (ctx, next) => {
                assert.equal(i, 0);
                done();
                next();
            });

            client.connect();
        });
    });
});
