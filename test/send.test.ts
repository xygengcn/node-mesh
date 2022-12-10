import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3001, host: '0.0.0.0', serverId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

describe('客户端和服务端的发消息测试', () => {
    after(() => {
        server.stop();
    });

    describe('单向发送', () => {
        it('客户端正常发送，服务端正常接收', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', id: 'test-client-send', targetId: 'server1' });
            client.connect();
            client.on('online', () => {
                client.request('test', 'helloworld');
                server.once('message', (c, message) => {
                    assert.equal(message.params, 'helloworld');
                    client.disconnect();
                    done();
                });
            });
        });
    });

    describe('双向测试', () => {
        it('客户端request，服务端response, 测试callback', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', id: 'test-server-response', targetId: 'server1' });
            server.response('action/test', (parmas) => {
                return parmas + '0';
            });
            client.connect();
            client.on('online', () => {
                client.request('action/test', '123456789', (error, body) => {
                    assert.equal(body, '1234567890');
                    client.disconnect();
                    done();
                });
            });
        });
        it('客户端request，服务端response, 测试promise', (done) => {
            const client = new ClientSocket({ port: 3001, host: '0.0.0.0', id: 'test-server-response', targetId: 'server1' });
            server.response('action/test', (parmas) => {
                return parmas + '0';
            });
            client.connect();
            client.on('online', () => {
                client.request('action/test', '123456789').then((result) => {
                    assert.equal(result, '1234567890');
                    client.disconnect();
                    done();
                });
            });
        });
    });
});
