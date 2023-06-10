import { Branch, Master } from '../../src';

/**
 * 类型推断测试
 */

const actions = {
    add: (a: number, b: number): number => {
        return a + b;
    },
    cut: () => {
        return '11';
    }
};

const actions2 = {
    add2: (a: string, b: string): string => {
        return a + b;
    }
};

const master1 = new Master<typeof actions & typeof actions2>('master1', { port: 3010 });

const branch1 = new Branch<typeof actions & typeof actions2>('branch1', { port: 3010 });

branch1.createRequester();

const branch2 = new Branch('branch1', { port: 3010 });

// 批量注册方法
master1.createResponder(actions2);

// 创建请求者
const masterReq = master1.createRequester();

// 批量注册方法
branch1.createResponder(actions);

// 创建请求者
const branchReq = branch1.createRequester();

// 请求
branchReq.add(11, 11).then((result) => {
    console.log('111', result);
});

// 请求
branchReq.add2('22', '22').then((result) => {
    console.log('222', result);
});

// 请求
masterReq.add(33, 33).then((result) => {
    console.log('333', result);
});

// 请求
masterReq.add2('44', '44').then((result) => {
    console.log('444', result);
});

// 禁止
branch1.$on('sss', (content) => {});

// content !== any
branch1.$on('logger', (content) => {});

// content !== any
branch1.$on('online', () => {});

// content !== any
branch1.$on('message', (content) => {});

// 禁止
branch1.request('add', 1).then((result) => {});

// result === number
branch1.request('add', 1, 2).then((result) => {});

// result === string
branch1.request('add2', '1', '1').then((result) => {});

// result === any
branch2.request('add2').then((result) => {});
