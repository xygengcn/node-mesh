import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3005, host: '0.0.0.0', serverId: 'server1' });

server.start();

describe('客户端上线离线，服务端收到通知', () => {
    before(() => {
        server.on('error', (error) => {
            assert.fail(error);
        });
    });
    after(() => {
        server.stop();
    });

    describe('客户端上线，并离线', () => {
        const client = new ClientSocket({ port: 3005, host: '0.0.0.0', clientId: 'client1', targetId: 'server1' });
        it('服务端收到上线通知', (done) => {
            server.once('sysMessage', (content) => {
                if (content.event === 'socket:online') {
                    assert.equal(content.clientId, 'client1');
                    assert.equal(content.serverId, 'server1');
                    done();
                }
            });
            client.connect();
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
            client.disconnect();
        });
    });
});
