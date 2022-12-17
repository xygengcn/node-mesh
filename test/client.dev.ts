import { ClientSocket } from '../src/index';

// const server = new ServerSocket({ port: 3003, host: '0.0.0.0', serverId: 'server1' });

// server.start();

// server.on('error', (error) => {
//     console.log('[server-error]', error);
// });

// server.response('action/error', () => {
//     return Promise.reject(Error('测试数据'));
// });

const client = new ClientSocket({ port: 3003, host: '0.0.0.0', id: 'test-server-response-callback', targetId: 'server1' });
client.connect();
client.on('online', () => {
    client.request('action/error', {}, (error, body) => {
        console.log('测试错误返回能力');
    });
});
