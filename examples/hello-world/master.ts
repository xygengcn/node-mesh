import Master from '@/services/master';

const master = new Master('master', { port: 3000 });

master.$on('online', () => {
    console.log('[master] 上线了');
});
