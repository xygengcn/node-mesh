import { ClientSocket } from '..';
import Context from '@/lib/context';
import { SocketMessage, SocketMessageType, SocketSysMsgContent, SocketSysEvent } from '@/typings/message';
import { ClientMiddleware } from '@/typings/socket';

/**
 * 服务端系统通知
 * @param server
 * @returns
 */
export default function clientSysMsgMiddleware(client: ClientSocket): ClientMiddleware {
    return (ctx: Context, next) => {
        if (ctx.body) {
            const message = ctx.toJson() as SocketMessage<any, SocketSysEvent>;
            // 系统通知
            if (message && typeof message === 'object' && message?.action && message?.msgId && message.type === SocketMessageType.broadcast) {
                const content = message.content.content as SocketSysMsgContent;
                ctx.log('[broadcast-receive]', '事件', content.event, '消息', message.msgId);
                client.emit('broadcast', message.action, content);
                if (/^socket:.+$/i.test(message?.action)) {
                    ctx.log('[sysMessage-receive]', message.msgId);
                    client.emit('sysMessage', content);
                }
                return;
            }
        }
        next();
    };
}
