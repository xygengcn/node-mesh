import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3001, host: '0.0.0.0', serverId: 'server1' });

const client = new ClientSocket({ port: 3001, host: '0.0.0.0', clientId: 'client1', serverId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

describe('客户端和服务端的发消息测试', () => {
    after(() => {
        server.stop();
        client.disconnect();
    });

    describe('正常发送接收', () => {
        it('单项发送', (done) => {
            client.connect();
            client.on('online', () => {
                client.send('test', '这是一句话');
                server.once('message', (client, message) => {
                    assert.equal(message.params, '这是一句话');
                    done();
                });
            });
        });
    });
});
