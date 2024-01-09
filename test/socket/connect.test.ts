import 'reflect-metadata';
import Client from '@/lib/client';
import Server from '@/lib/server';
import assert from 'assert';
import { describe, it } from 'mocha';

const client1 = new Client({ port: 4001, namespace: 'client1' });
const server = new Server({ port: 4001, namespace: 'server1' });

describe('正常测试socket连接事件', () => {
    after(() => {
        client1.disconnect();
        server.$off();
        client1.$off();
        server.disconnect();
    });
    it('服务端启动', (done) => {
        server.$once('online', () => {
            done();
        });
        server.createSocket();
        server.connect();
    });

    it('客户端启动，服务端收到监听', (done) => {
        client1.$once('connect', () => {
            server.$once('clientConnect', () => {
                done();
            });
        });
        client1.$on('offline', () => {
            done(Error);
        });
        client1.$on('error', (e) => {
            done(e);
        });
        client1.createSocket();
        client1.connect();
    });
});

describe('测试socket重新连接事件', () => {
    after(() => {
        client1.$off();
        server.$off();
        client1.disconnect();
        server.disconnect();
    });
    it('服务端重新启动', (done) => {
        server.$once('online', () => {
            done();
        });
        server.$on('error', (e) => {
            done(e);
        });
        server.createSocket();
        server.connect();
    });

    it('客户端重连接，服务端收到监听', (done) => {
        client1.$once('reconnect', () => {
            assert.ok('ok');
            client1.$once('connect', () => {
                assert.ok('ok');
            });
            server.$once('clientConnect', () => {
                done();
            });
            client1.$once('error', (e) => {
                done(e);
            });
            client1.options.port = 4001;
        });
        client1.$once('error', (e) => {
            assert.equal(e instanceof Error, true);
        });
        // 修改端口
        client1.options.port = 4002;
        client1.createSocket();
        client1.connect();
    });
});

describe('测试socket断开事件', () => {
    after(() => {
        client1.disconnect();
        server.$off();
        client1.$off();
        server.disconnect();
    });
    afterEach(() => {
        server.$off();
    });
    it('服务端断开客户端', (done) => {
        let remoteId = null;
        server.$on('clientOnline', (c) => {
            assert.ok('ok');
            remoteId = c.id;
        });
        server.$on('clientOffline', () => {
            done();
        });
        server.createSocket();
        server.connect();
        client1.createSocket();
        client1.connect();
        setTimeout(() => {
            server.offline(remoteId);
        }, 1000);
    });

    it('客户端自己断开', (done) => {
        server.$on('clientOffline', () => {
            assert.ok('ok');
            done();
        });
        server.createSocket();
        server.connect();
        client1.createSocket();
        client1.connect();
        setTimeout(() => {
            client1.disconnect();
        }, 1000);
    });
});
