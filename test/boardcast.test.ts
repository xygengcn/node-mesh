import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3007, serverId: 'server1' });
const client1 = new ClientSocket({ port: 3007, host: '0.0.0.0', clientId: 'client1', targetId: 'server1' });
const client2 = new ClientSocket({ port: 3007, host: '0.0.0.0', clientId: 'client2', targetId: 'server1' });
const client3 = new ClientSocket({ port: 3007, host: '0.0.0.0', clientId: 'client3', targetId: 'server1' });

server.start();

server.on('error', (error) => {
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
        it('客户端1广播，客户端2，3和服务端收到广播，内容相同', (done) => {
            let index = 0;
            let result = 0;
            server.on('sysMessage', (sysMsgContent) => {
                if (sysMsgContent.event === 'socket:online') {
                    index++;
                    if (index === 3) {
                        client1.broadcast('test', {
                            event: 'client-test',
                            content: 'client-testcontent'
                        });
                    }
                }
            });
            const func = (msgContent) => {
                assert.equal(msgContent.content, 'client-testcontent');
                result++;
                if (result === 3) {
                    done();
                }
            };
            client1.on('broadcast', (action, msgContent) => {
                if (action === 'test' && msgContent.event === 'client-test') {
                    client1.off('broadcast');
                    assert.fail('发出广播的不能收到广播');
                }
            });
            client2.on('broadcast', (action, msgContent) => {
                if (action === 'test' && msgContent.event === 'client-test') {
                    func(msgContent);
                    client2.off('broadcast');
                }
            });
            client3.on('broadcast', (action, msgContent) => {
                if (action === 'test' && msgContent.event === 'client-test') {
                    func(msgContent);
                    client3.off('broadcast');
                }
            });
            server.on('broadcast', (action, msgContent) => {
                if (action === 'test' && msgContent.event === 'client-test') {
                    func(msgContent);
                    server.off('broadcast');
                }
            });

            // 开始链接
            client1.connect();
            client2.connect();
            client3.connect();
        });

        it('服务端广播，客户端收到', (done) => {
            let result = 0;

            const func = (msgContent) => {
                assert.equal(msgContent.content, 'server-testcontent');
                result++;
                if (result === 3) {
                    done();
                }
            };
            client1.on('broadcast', (action, msgContent) => {
                if (action === 'test' && msgContent.event === 'server-test') {
                    func(msgContent);
                    client1.off('broadcast');
                }
            });
            client2.on('broadcast', (action, msgContent) => {
                if (action === 'test' && msgContent.event === 'server-test') {
                    func(msgContent);
                    client2.off('broadcast');
                }
            });
            client3.on('broadcast', (action, msgContent) => {
                if (action === 'test' && msgContent.event === 'server-test') {
                    func(msgContent);
                    client3.off('broadcast');
                }
            });
            server.on('broadcast', (action, msgContent) => {
                if (action === 'test' && msgContent.event === 'server-test') {
                    func(msgContent);
                    server.off('broadcast');
                }
            });

            server.broadcast('test', {
                event: 'server-test',
                content: 'server-testcontent'
            });
        });
    });
});
