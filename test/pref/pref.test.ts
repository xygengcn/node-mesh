import assert from 'assert';
import { Master, Branch } from '../../src/index';
import fs from 'fs';
import path from 'path';

const server = new Master('master', { port: 3002 });

const actions = { add: (num: string) => {} };

const clients: Branch<typeof actions>[] = [];

/**
 * 发送文本
 */
const text = fs.readFileSync(path.join(__dirname, './text.txt')).toString();

/**
 * 客户端数量
 */
const ClientMaxNums = 10;

/**
 * 发消息数量
 */
const MessageMaxNums = 1000;

/**
 * 批量创建客户端
 */
for (let i = 0; i < ClientMaxNums; i++) {
    const client = new Branch<typeof actions>('branch-' + i, { port: 3002, master: 'master' });
    client.on('error', (error) => {
        console.log('[client-error]', error);
    });
    clients.push(client);
}

server.on('error', (error) => {
    console.log('[server-error]', error);
});

server.response('add', (i) => {
    return i;
});

describe('客户端和服务端的发消息性能测试', () => {
    after(() => {
        clients.forEach((c) => {
            c.stop();
        });
        server.stop();
    });
    describe('双向测试', () => {
        it('客户端request，服务端response, 测试10000次的时间', (done) => {
            const func = (client: Branch<typeof actions>) => {
                const requests: Promise<any>[] = [];
                let resultNum = 0;
                for (let i = 0; i < MessageMaxNums; i++) {
                    const data = new Date().getTime() + '-i-' + text;
                    const promise = client
                        .request('add', data)
                        .then((result) => {
                            assert.equal(result, data);
                            resultNum++;
                        })
                        .catch((e) => {
                            done(e);
                        });

                    requests.push(promise);
                }
                return Promise.allSettled(requests)
                    .then((result) => {
                        assert.equal(resultNum, MessageMaxNums);
                    })
                    .catch((e) => {
                        done(e);
                    });
            };

            let clientNums = 0;
            const promises = clients.map((c) => {
                clientNums++;
                return func(c);
            });
            Promise.allSettled(promises)
                .then(() => {
                    assert.equal(clientNums, ClientMaxNums);
                    done();
                })
                .catch((e) => {
                    done(e);
                });
        });
    });
});
