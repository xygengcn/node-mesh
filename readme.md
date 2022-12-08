# 建立主分支形式 Nodejs 微服务框架

## 客户端与服务端绑定

客户端与服务端建立 connect，客户端发出绑定通知，服务端接收绑定通知，校验返回结果，完成绑定

## 单主分支

master 启动 -》 branch 建立链接 -》 注册 action 到 master 缓存 -》 通知其他分支上线

分支请求动作 -》 检查自己有没有 action -》 检查有没有缓存 action -》 请求 action

分支下线 -》 清除 master 上的分支 action 缓存 -》 通知其他分支下线
