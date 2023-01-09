import { ClientSocket } from '..';
import Context from '@/lib/context';
import { SocketMessage, SocketMessageType, SocketSysMsgContent } from '@/typings/message';
import { ClientMiddleware } from '@/typings/socket';

/**
 * 服务端系统通知
 * @param server
 * @returns
 */
export default function clientSysMsgMiddleware(client: ClientSocket): ClientMiddleware {
    return (ctx: Context, next) => {
        if (ctx.body) {
            const message: SocketMessage = ctx.toJson();
            // 系统通知
            if (
                message &&
                typeof message === 'object' &&
                message?.action &&
                message?.msgId &&
                /^socket:.+$/i.test(message?.action) &&
                message.type === SocketMessageType.notification
            ) {
                ctx.debug('[sysMessage]', message.msgId);
                const content = message.content.content as SocketSysMsgContent;
                client.emit('sysMessage', content);
                return;
            }
        }
        next();
    };
}
