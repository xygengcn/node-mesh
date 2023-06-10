import Branch from '@/services/branch';

const branch = new Branch('branch', { port: 3000 });

branch.$on('online', () => {
    console.log('[branch]上线了');
});
