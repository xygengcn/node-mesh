import { Client, Server } from '@/index';
import assert from 'assert';

const server = new Server({ port: 3008, namespace: 'server1' });
const client1 = new Client({ port: 3008, namespace: 'client1' });
const client2 = new Client({ port: 3008, namespace: 'client2' });

client1.response('action/test', (a, b, c) => {
    return (a + b) * c;
});

server.createSocket();
client1.createSocket();
client2.createSocket();

server.connect();
client1.connect();
client2.connect();

server.$on('error', (error) => {
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
            client2.request('action/test', [1, 1, 2], (error, result) => {
                assert.equal(result, 4);
                done(error);
            });
        });
    });
});
