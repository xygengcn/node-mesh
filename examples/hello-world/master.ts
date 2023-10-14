import Master from '@/services/master';

const master = new Master('master', { port: 3000 });

master.$on('online', () => {
    console.log('[master] 上线了');
});

master.$on('logger', (...args) => {
    console.log('[branch]', ...args);
});

master.$on('clientOnline', (connection) => {
    console.debug('[client-online]', connection.id, connection.status, connection.name);
});

master.$on('clientOffline', (connection) => {
    console.debug('[client-offline]', connection.id, connection.status, connection.name);
});
