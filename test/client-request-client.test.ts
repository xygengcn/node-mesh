import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3008, serverId: 'server1' });

const client1 = new ClientSocket({ port: 3008, host: '0.0.0.0', clientId: 'client1', targetId: 'server1' });
const client2 = new ClientSocket({ port: 3008, host: '0.0.0.0', clientId: 'client2', targetId: 'server1' });

client1.response('action/test', (a, b) => {
    return a + b;
});

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

describe('客户端请求客户端测试', () => {
    after(() => {
        client1.disconnect();
        client2.disconnect();
        server.disconnect();
    });

    describe('单向请求', () => {
        it('客户端1注册，客户端2请求成功', (done) => {
            let index = 0;
            server.on('sysMessage', (syscontent) => {
                if (syscontent.event === 'socket:online') {
                    index++;
                    if (index === 2) {
                        client2
                            .request('action/test', 1, 1)
                            .then((result) => {
                                assert.equal(result, 2);
                                done();
                            })
                            .catch((e) => {
                                assert.fail(e);
                            });
                    }
                }
            });
            client1.connect();
            client2.connect();
        });

        // it('客户端注册，客户端离线，客户端请求失败', (done) => {});
    });
});
