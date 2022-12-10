import assert from 'assert';
import { ClientSocket, ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3002, host: '0.0.0.0', serverId: 'server1' });
const client = new ClientSocket({ port: 3002, host: '0.0.0.0', id: 'test-pref', targetId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

let result = 0;
server.response('action/test', () => {
    result++;
    return result;
});

describe('客户端和服务端的发消息性能测试', () => {
    after(() => {
        server.stop();
    });
    describe('双向测试', () => {
        it('客户端request，服务端response, 测试100次的时间', (done) => {
            client.connect();
            client.on('online', () => {
                const time = new Date().getTime();
                const arr: Promise<any>[] = [];
                // 1万次测试 , 消耗时间:  1111 ms  1230 ms 1159 ms 1376 ms
                const nums = 10000;
                for (let i = 0; i < nums; i++) {
                    arr.push(client.request('action/test', i));
                }
                Promise.all(arr)
                    .then(() => {
                        assert.equal(result, nums);
                        client.disconnect();
                        console.log('消耗时间: ', new Date().getTime() - time, 'ms');
                        done();
                    })
                    .catch((e) => {
                        client.disconnect();
                        console.log('消耗时间: ', new Date().getTime() - time, 'ms');
                        console.error('[错误]', e);
                        done(e);
                    });
            });
            client.on('error', (e) => {
                console.log('[client-error]', e);
            });
        });
    });
});
