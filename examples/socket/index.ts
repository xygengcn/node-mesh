import 'reflect-metadata';
import { Client, Server } from '@/index';

const server = new Server({ port: 3000, namespace: 'server' });
const client = new Client({ port: 3000, namespace: 'client' });

server.createSocket();

client.createSocket();

server.connect();

client.connect();

server.response('server-action', (a, b, c) => {
    return a + b + c + 1;
});

client.response('client-action', (a, b, c) => {
    return a + b + c;
});

client.request('client-action', [1, 2, 3], (error, result) => {
    console.log('client-to-self', error, result);
});

client.request('server-action', [1, 2, 3], (error, result) => {
    console.log('client-to-server', error, result);
});

server.request('server-action', [1, 2, 3], (error, result) => {
    console.log('server-to-self', error, result);
});

setTimeout(() => {
    server.connectionManager.end(client.socket.localId());
}, 2000);
