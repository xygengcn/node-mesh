import Branch from '@/services/branch';

const branch = new Branch('branch', { port: 3000, heartbeat: 1000 });

branch.response('test', () => {});

branch.$on('online', () => {
    console.log('[branch]上线了');
});

branch.$on('logger', (...args) => {
    console.log('[branch]', ...args);
});
