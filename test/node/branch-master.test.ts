import Master from '@/services/master';
import Branch from '@/services/branch';
import assert from 'assert';
import { doneTimes } from 'test/utils';

const actions = {
    add: (a: number, b: number): number => {
        return a + b;
    }
};

const actions2 = {
    add2: (a: number, b: number): number => {
        return a + b + 1;
    }
};

const master1 = new Master<typeof actions & typeof actions2>('master1', { port: 3010 });

master1.createResponder(actions2);

const masterReq = master1.createRequester();

const branch1 = new Branch<typeof actions & typeof actions2>('branch1', { port: 3010 });

branch1.createResponder(actions);

const branchReq1 = branch1.createRequester();

const branch2 = new Branch<typeof actions & typeof actions2>('branch2', { port: 3010 });

const branchReq2 = branch2.createRequester();

master1.connect();

branch1.connect();

branch2.connect();

describe('客户端和服务端的通信测试', () => {
    after(() => {
        branch1.disconnect();
        branch2.disconnect();
        master1.disconnect();
    });

    describe('客户端请求', () => {
        it('客户端请求，客户端返回', (done) => {
            branchReq1
                .add(1, 2)
                .then((result) => {
                    assert.equal(result, 3);
                })
                .catch((e) => {
                    done(e);
                })
                .finally(() => {
                    done();
                });
        });
        it('客户端请求，服务端返回', (done) => {
            branchReq1
                .add2(1, 2)
                .then((result) => {
                    assert.equal(result, 4);
                })
                .catch((e) => {
                    done(e);
                })
                .finally(() => {
                    done();
                });
        });

        it('客户端2请求，客户端1返回', (done) => {
            branchReq2
                .add(2, 4)
                .then((result) => {
                    assert.equal(result, 6);
                    done();
                })
                .catch((e) => {
                    done(e);
                });
        });
    });

    describe('服务端请求', () => {
        it('服务端请求，服务端返回', (done) => {
            masterReq
                .add2(1, 2)
                .then((result) => {
                    assert.equal(result, 4);
                })
                .catch((e) => {
                    done(e);
                })
                .finally(() => {
                    done();
                });
        });
        it('服务端请求，客户端返回', (done) => {
            masterReq
                .add(2, 3)
                .then((result) => {
                    assert.equal(result, 5);
                })
                .catch((e) => {
                    done(e);
                })
                .finally(() => {
                    done();
                });
        });
    });

    describe('服务端请求', () => {
        beforeEach(() => {
            master1.$off('notification');
            branch1.$off('notification');
            branch2.$off('notification');
        });
        it('服务端请求，服务端返回', (done) => {
            masterReq
                .add2(1, 2)
                .then((result) => {
                    assert.equal(result, 4);
                })
                .catch((e) => {
                    done(e);
                })
                .finally(() => {
                    done();
                });
        });
        it('服务端广播，客户端接收', (done) => {
            master1.broadcast('socket:notification', { event: 'notification' });
            const done2 = doneTimes(2, () => {
                done();
            });
            branch1.$on('notification', (message) => {
                if (message.action === 'socket:notification') {
                    done2(message.action === 'socket:notification');
                }
            });
            branch2.$on('notification', (message) => {
                if (message.action === 'socket:notification') {
                    done2(message.action === 'socket:notification');
                }
            });
        });
        it('客户端广播，客户端和服务端接收', (done) => {
            branch1.broadcast('socket:notification', { event: 'notification' });
            const done2 = doneTimes(2, () => {
                done();
            });
            master1.$on('notification', (message) => {
                if (message.action === 'socket:notification') {
                    done2(message.action === 'socket:notification');
                }
            });
            branch2.$on('notification', (message) => {
                if (message.action === 'socket:notification') {
                    done2(message.action === 'socket:notification');
                }
            });
        });
    });
});
