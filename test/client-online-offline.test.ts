import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3005, serverId: 'server1' });

server.start();

describe('客户端上线离线，其他端收到通知', () => {
    before(() => {
        server.on('error', (error) => {
            assert.fail(error);
        });
    });
    after(() => {
        server.stop();
    });

    describe('客户端上线，并离线，服务端收到通知', () => {
        const client1 = new ClientSocket({ port: 3005, host: '0.0.0.0', clientId: 'client1', targetId: 'server1' });
        it('服务端收到上线通知', (done) => {
            server.once('sysMessage', (content) => {
                if (content.event === 'socket:online') {
                    assert.equal(content.clientId, 'client1');
                    assert.equal(content.serverId, 'server1');
                    done();
                }
            });
            client1.connect();
        });

        it('服务端收到下线通知', (done) => {
            server.once('sysMessage', (content) => {
                if (content.event === 'socket:offline') {
                    assert.equal(content.clientId, 'client1');
                    assert.equal(content.serverId, 'server1');
                    server.off('sysMessage');
                    done();
                }
            });
            client1.disconnect();
        });
    });

    describe('客户端2上线，并离线，客户端3收到通知', () => {
        const client2 = new ClientSocket({ port: 3005, host: '0.0.0.0', clientId: 'client2', targetId: 'server1' });
        const client3 = new ClientSocket({ port: 3005, host: '0.0.0.0', clientId: 'client3', targetId: 'server1' });

        it('客户端3收到上线通知', (done) => {
            client3.connect();
            client3.once('online', () => {
                client3.once('sysMessage', (content) => {
                    if (content.event === 'socket:online' && content.clientId === 'client2') {
                        done();
                    } else {
                        done(new Error('通知失败'));
                    }
                });
                client2.connect();
            });
        });

        it('客户端3收到下线通知', (done) => {
            client3.once('sysMessage', (content) => {
                if (content.event === 'socket:offline' && content.clientId === 'client2') {
                    done();
                    client3.disconnect();
                } else {
                    done(new Error('通知失败'));
                    client3.disconnect();
                }
            });
            client2.disconnect();
        });
    });
});
