import { container, injectable } from '@/inversify/container';
import { CONSTANT_KEY } from '@/inversify/inversify.config';
import { MiddlewareParamKey } from '@/lib/middleware';
import { Constructor } from '@/typings';

/**
 * 中间件
 * @returns
 */
export function Middleware() {
    return (target: Constructor) => {
        injectable()(target);
        container.bind<Constructor>(target).to(target);
    };
}

/**
 * 注入
 * @returns
 */
export function Inject(name: MiddlewareParamKey) {
    return (target: Object, propertyKey: string, parameterIndex) => {
        const params: Array<{ key: string; index: number; name: MiddlewareParamKey }> = Reflect.getMetadata(CONSTANT_KEY.MIDDLEWARE_INJECT, target, propertyKey) || [];
        params.unshift({
            key: propertyKey,
            name,
            index: parameterIndex
        });
        Reflect.defineMetadata(CONSTANT_KEY.MIDDLEWARE_INJECT, params, target, propertyKey);
    };
}

/**
 * 事件监听
 * @param event
 */
export function Event(event: string) {
    return (target: Object, propertyKey: string) => {
        const params: Array<{ event: string; propertyKey }> = Reflect.getMetadata(CONSTANT_KEY.MIDDLEWARE_EVENT, target, propertyKey) || [];
        params.unshift({
            event,
            propertyKey
        });
        Reflect.defineMetadata(CONSTANT_KEY.MIDDLEWARE_EVENT, params, target);
    };
}
