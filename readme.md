# Master - Branch 形式 Nodejs 微服务框架

## 用法(Usage)

### Request - Response

```ts
import { Master, Branch } from 'node-octopus';

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
    console.log('111', result); // 22
});

// 请求
branchReq.add2(22, 22).then((result) => {
    console.log('222', result); // 45
});

// 请求
masterReq.add(33, 33).then((result) => {
    console.log('333', result); // 66
});

// 请求
masterReq.add2(44, 44).then((result) => {
    console.log('444', result); // 89
});
```

## 原理(Design)

### 客户端与服务端绑定(bind)

客户端与服务端建立 connect，客户端发出绑定通知，服务端接收绑定通知，校验返回结果，完成绑定

### 单主分支(branch)

master 启动 -》 branch 建立链接 -》 注册 action 到 master 缓存 -》 通知其他分支上线

分支请求动作 -》 检查自己有没有 action -》 检查有没有缓存 action -》 请求 action

分支下线 -》 清除 master 上的分支 action 缓存 -》 通知其他分支下线

## 错误列表(Error)

| code  | 说明                               |     |
| ----- | ---------------------------------- | --- |
| 30001 | Action 不为 string，或者不存在     |     |
| 30002 | 客户端未连接上服务端               |     |
| 30003 | 请求操时                           |     |
| 30004 | socket write 写入失败              |     |
| 30005 |                                    |     |
| 30006 | 请求客户端过程，服务端未启动       |     |
| 30007 | 请求客户端过程，客户端不在线       |     |
| 30008 | 客户端绑定过程，服务端类型错误     |     |
| 30009 | 客户端绑定失败回调                 |     |
| 30010 | 服务端端口为空                     |     |
| 30011 | 注册方法不可修改                   |     |
| 30012 | 服务端广播消息，服务器未启动       |     |
| 30013 |                                    |     |
| 30014 | 客户端断开连接                     |     |
| 30015 | 客户端发消息缺失参数               |     |
| 30016 | 链接后，客户端不发起绑定，超时处理 |     |
| 30017 | 客户端增加订阅，服务端处理失败     |     |
