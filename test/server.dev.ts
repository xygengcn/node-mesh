import { ServerSocket } from '../src/index';

const server = new ServerSocket({ port: 3003, host: '0.0.0.0', serverId: 'server1' });

server.start();

server.on('error', (error) => {
    console.log('[server-error]', error);
});

server.response('action/error', () => {
    return Promise.reject(Error('测试数据'));
});

// 测试5秒后断开
// setTimeout(() => {
//     server.stop();
// }, 5000);
