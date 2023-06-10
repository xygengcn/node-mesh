# Master - Branch 形式 Nodejs 微服务框架

## 一、用法(Usage)

Master 和 Branch 可以是不同文件的不同进程，为了方便示例，都放在同一个文件

### 1、 Request - Response

---

```ts
import { Master, Branch } from 'node-mesh';

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

const branch1 = new Branch<typeof actions & typeof actions2>('branch1', { port: 3010, master: 'master1' });

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
    console.log('result1', result); // 22
});

// 请求
branchReq.add2(22, 22).then((result) => {
    console.log('result2', result); // 45
});

// 请求
masterReq.add(33, 33).then((result) => {
    console.log('result3', result); // 66
});

// 请求
masterReq.add2(44, 44).then((result) => {
    console.log('result4', result); // 89
});
```

### 2、Subscribe - Publish

---

```ts
import { Master, Branch } from 'node-mesh';

const master1 = new Master('master1', { port: 3010 });

const branch1 = new Branch('branch1', { port: 3010, master: 'master1' });

// Subscribe
master1.subscribe('sub/test', (error, content) => {
    console.log(555, content); // content === sub
});

// Publish
branch1.publish('sub/test', 'sub');
```

## 二、原理(Design)

### 1、客户端与服务端绑定(bind)

---

客户端与服务端建立 connect，客户端发出绑定通知，服务端接收绑定通知，校验返回结果，完成绑定

### 2、单主分支(branch)

---

master 启动 -》 branch 建立链接 -》 注册 action 到 master 缓存 -》 通知其他分支上线

分支请求动作 -》 检查自己有没有 action -》 检查有没有缓存 action -》 请求 action

分支下线 -》 清除 master 上的分支 action 缓存 -》 通知其他分支下线

## 三、错误列表(Error)

| code | 说明           |     |
| ---- | -------------- | --- |
| 0    | 成功           |     |
| 1    | 未知错误       |     |
| 2    | 请求超时       |     |
| 3    | 客户端绑定失败 |     |
