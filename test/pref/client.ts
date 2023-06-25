import { Branch } from '@/index';
import Stats from '@/stats';
import assert from 'assert';
import fs from 'fs';
import path from 'path';

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
 *
 *
 * 1000压力测试没有通过
 */
const MessageMaxNums = 1000;

/**
 * 批量创建客户端
 */
for (let i = 0; i < ClientMaxNums; i++) {
    const client = new Branch<typeof actions>('branch-' + i, { port: 3002, logger: false });
    const stat = new Stats(1000);
    client.$on('send', () => {
        stat.record();
    });
    client.$on('offline', () => {
        stat.stop();
        console.log('branch-' + i, stat.result());
    });
    client.$on('error', (error) => {
        console.log('[client-error]', error);
    });
    clients.push(client);
}

describe('客户端和服务端的发消息性能测试', () => {
    after(() => {
        clients.forEach((c) => {
            c.disconnect();
        });
    });
    it('客户端request，服务端response, 测试n次的时间', (done) => {
        const func = (client: Branch<typeof actions>, index: number) => {
            const requests: Promise<any>[] = [];
            let resultNum = 0;
            for (let i = 0; i < MessageMaxNums; i++) {
                const data = new Date().getTime() + '-i-' + text;
                const promise = client
                    .request('add',data)
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
                    console.error('requests allSettled', e);
                    done(e);
                });
        };

        let clientNums = 0;
        const promises = clients.map((c, index) => {
            clientNums++;
            return func(c, index);
        });
        Promise.allSettled(promises)
            .then(() => {
                assert.equal(clientNums, ClientMaxNums);
                done();
            })
            .catch((e) => {
                console.error('clientNums index', clientNums, e);
                done(e);
            });
    });
});
