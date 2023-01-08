# 建立主分支形式 Nodejs 微服务框架

## 客户端与服务端绑定

客户端与服务端建立 connect，客户端发出绑定通知，服务端接收绑定通知，校验返回结果，完成绑定

## 单主分支

master 启动 -》 branch 建立链接 -》 注册 action 到 master 缓存 -》 通知其他分支上线

分支请求动作 -》 检查自己有没有 action -》 检查有没有缓存 action -》 请求 action

分支下线 -》 清除 master 上的分支 action 缓存 -》 通知其他分支下线

## 错误列表

| code  | 说明                           |     |
| ----- | ------------------------------ | --- |
| 30001 | Action 不为 string，或者不存在 |     |
| 30002 | 客户端未连接上服务端           |     |
| 30003 | 请求操时                       |     |
| 30004 | socket write 写入失败          |     |
| 30005 | 服务端请求不存在               |     |
| 30006 | 请求客户端过程，服务端未启动   |     |
| 30007 | 请求客户端过程，客户端不在线   |     |
| 30008 | 客户端绑定过程，服务端类型错误 |     |
| 30009 | 客户端绑定失败回调             |     |
| 30010 | 服务端端口为空                 |     |
