import { Master } from '@/index';
import Branch from '@/lib/node/branch';
import assert from 'assert';

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

const branch1 = new Branch<typeof actions & typeof actions2>('branch1', { port: 3010, master: 'master1' });

branch1.createResponder(actions);

const branchReq1 = branch1.createRequester();

const branch2 = new Branch<typeof actions & typeof actions2>('branch2', { port: 3010, master: 'master1' });

const branchReq2 = branch2.createRequester();

describe('客户端和服务端的绑定测试', () => {
    after(() => {
        branch1.stop();
        branch2.stop();
        master1.stop();
    });

    describe('客户端请求', () => {
        it('客户端请求，客户端返回', (done) => {
            branchReq1
                .add(1, 2)
                .then((result) => {
                    assert.equal(result, 3);
                })
                .catch((e) => {
                    assert.fail(e);
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
                    assert.fail(e);
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
                })
                .catch((e) => {
                    assert.fail(e);
                })
                .finally(() => {
                    done();
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
                    assert.fail(e);
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
                    assert.fail(e);
                })
                .finally(() => {
                    done();
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
                    assert.fail(e);
                })
                .finally(() => {
                    done();
                });
        });
        it('服务端广播，客户端接收', (done) => {
            master1.broadcast('socket:notification', { event: 'sss', content: 111 });
            let index = 0;
            const fun = () => {
                index++;
                if (index === 2) {
                    done();
                }
            };
            branch1.on('broadcast', (action, content) => {
                if (action === 'socket:notification') {
                    assert.equal(content.event, 'sss');
                    assert.equal(content.content, 111);
                    fun();
                }
            });
            branch2.on('broadcast', (action, content) => {
                if (action === 'socket:notification') {
                    assert.equal(content.event, 'sss');
                    assert.equal(content.content, 111);
                    fun();
                }
            });
        });
        it('客户端广播，客户端和服务端接收', (done) => {
            branch1.broadcast('socket:notification', { event: 'sss', content: 111 });
            let index = 0;
            const fun = () => {
                index++;
                if (index === 2) {
                    done();
                }
            };
            master1.on('broadcast', (action, content) => {
                if (action === 'socket:notification') {
                    assert.equal(content.event, 'sss');
                    assert.equal(content.content, 111);
                    fun();
                }
            });
            branch2.on('broadcast', (action, content) => {
                if (action === 'socket:notification') {
                    assert.equal(content.event, 'sss');
                    assert.equal(content.content, 111);
                    fun();
                }
            });
        });
    });
});
