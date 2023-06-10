import { Master } from '@/index';
import Stats from '@/stats';

const server = new Master('master', { port: 3002, logger: false });

const onMessageStat = new Stats(1000);

const sendStat = new Stats(1000);

/**
 * 计算处理耗时
 */
server.$on('message', () => {
    onMessageStat.record();
});
// onMessageStat [
//     19, 151, 231, 230, 0, 230, 230, 240,
//    231, 318,   0, 378, 0, 406,   0, 411,
//      0, 432,   0, 438, 0, 434,   0, 470,
//      0, 465,   0, 471
//  ]
//  sendStat [
//     10, 150, 231, 230, 0, 230, 230, 240,
//    231, 318,   0, 378, 0, 406,   0, 411,
//      0, 432,   0, 438, 0, 434,   0, 470,
//      0, 465,   0, 471
//  ]
server.$on('send', () => {
    sendStat.record();
});

server.$on('error', (error) => {
    console.log('[server-error]', error);
});

server.response('add', (i, data) => {
    return data;
});

server.$on('offline', () => {
    onMessageStat.stop();
    sendStat.stop();
    console.log('onMessageStat', onMessageStat.result());
    console.log('sendStat', sendStat.result());
});
