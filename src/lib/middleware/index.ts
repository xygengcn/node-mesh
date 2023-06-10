import { CONSTANT_KEY } from '@/inversify/inversify.config';
import { compose, isClassInstance, isFunction } from '@/utils';
import { Message } from '../message';

/**
 * next
 */
export type Next = () => Promise<void>;

/**
 * 函数中间件
 */
export type MiddlewareFunction = ((message: Message<any>, next: () => Promise<void>) => void) | ((message: Message<any>, next: () => Promise<void>) => Promise<void>);

/**
 * 参数key
 */
export enum MiddlewareParamKey {
    client = 'client',
    server = 'server',
    transport = 'transport',
    socket = 'socket'
}

// class中间件
export type MiddlewareClass = {
    // 忽略
    ignore?(message: Message): boolean;
    // 判定
    match?(message: Message): boolean;
    // 执行
    bind(...injects: any[]): MiddlewareFunction;
};

export default class MiddlewareManager {
    /**
     * 插件列表
     */
    private middlewareList: MiddlewareFunction[] = [];

    /**
     * 生成的插件
     */
    private middleware: (message: Message) => Promise<any> = () => Promise.resolve();

    /**
     * 加载中间
     * @param message
     */
    public execute(message: Message) {
        return this.middleware(message);
    }

    /**
     * 注册插件
     * @param plugin
     */
    public use(...plugins: Array<MiddlewareClass | MiddlewareFunction>): this {
        plugins.forEach((middlewareClassInstance) => {
            // 类中间件
            if (isClassInstance(middlewareClassInstance) && typeof middlewareClassInstance === 'object') {
                // 获取注入的客户端
                const client = Reflect.getMetadata(CONSTANT_KEY.MIDDLEWARE_CLIENT, middlewareClassInstance) || undefined;
                // 获取注入的服务端
                const server = Reflect.getMetadata(CONSTANT_KEY.MIDDLEWARE_SERVER, middlewareClassInstance) || undefined;

                // 获取注入的transport
                const transport = Reflect.getMetadata(CONSTANT_KEY.MIDDLEWARE_TRANSPORT, middlewareClassInstance);

                // 注入转换
                let injectConvertParams = (list: Array<{ key: string; index: number; name: MiddlewareParamKey }>) => {
                    return list.map((param) => {
                        if (param.name === MiddlewareParamKey.client) {
                            return client;
                        }
                        if (param.name === MiddlewareParamKey.server) {
                            return server;
                        }
                        if (param.name === MiddlewareParamKey.transport) {
                            return transport;
                        }
                        if (param.name === MiddlewareParamKey.socket) {
                            return client || server;
                        }
                        return undefined;
                    });
                };

                // 获取需要注入的参数
                const bindParamInjectList: Array<{ key: string; index: number; name: MiddlewareParamKey }> =
                    Reflect.getMetadata(CONSTANT_KEY.MIDDLEWARE_INJECT, middlewareClassInstance, CONSTANT_KEY.MIDDLEWARE_BIND_PROPERTYKEY) || [];

                // 最终需要插入的参数
                const bindParams = injectConvertParams(bindParamInjectList);

                // 客户端或者服务端
                // 执行事件监听
                const socket = client || server;
                if (socket) {
                    const events: Array<{ event: string; propertyKey }> = Reflect.getMetadata(CONSTANT_KEY.MIDDLEWARE_EVENT, middlewareClassInstance) || [];
                    events.forEach((event) => {
                        // 获取需要注入的参数
                        const eventParamInjectList: Array<{ key: string; index: number; name: MiddlewareParamKey }> =
                            Reflect.getMetadata(CONSTANT_KEY.MIDDLEWARE_INJECT, middlewareClassInstance, event.propertyKey) || [];
                        // 最终需要插入的参数
                        const eventParams = injectConvertParams(eventParamInjectList);
                        if (isFunction(middlewareClassInstance[event.propertyKey])) {
                            socket.$on(event.event, middlewareClassInstance[event.propertyKey].apply(middlewareClassInstance, eventParams));
                        }
                    });
                }

                // 是否有中间件
                if (middlewareClassInstance.bind && isFunction(middlewareClassInstance.bind)) {
                    // 先执行
                    const middleware = middlewareClassInstance.bind(...bindParams);

                    const middlewareFunction: MiddlewareFunction = async (message, next) => {
                        // 是否有匹配的
                        if (middlewareClassInstance?.match && isFunction(middlewareClassInstance?.match)) {
                            if (!middlewareClassInstance.match(message)) {
                                return await next();
                            }
                        }
                        // 是否有忽略
                        if (middlewareClassInstance?.ignore && isFunction(middlewareClassInstance?.ignore)) {
                            if (middlewareClassInstance.ignore(message)) {
                                return await next();
                            }
                        }

                        // 开始执行
                        if (isFunction(middleware)) {
                            middleware(message, next);
                        }
                    };
                    // 插入
                    this.middlewareList.unshift(middlewareFunction);
                }

                // 清理
                injectConvertParams = null;
                return;
            }

            // 函数中间价
            if (isFunction(middlewareClassInstance) && typeof middlewareClassInstance === 'function') {
                // 插入
                this.middlewareList.unshift(middlewareClassInstance);
            }
        });
        if (this.middlewareList.length) {
            this.middleware = compose(...this.middlewareList);
        }
        return this;
    }

    // 清空
    public clear() {
        this.middlewareList = [];
        this.middleware = null;
    }
}
