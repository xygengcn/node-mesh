import PQueue from 'p-queue';

const Queue: typeof PQueue = require('p-queue').default;

export type IQueue = PQueue;
export default Queue;
