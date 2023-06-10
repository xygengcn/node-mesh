// 测试用例的写法
import 'reflect-metadata';
import { describe, it } from 'mocha';
import { EventEmitter } from '@/emitter';
import { equal } from 'assert';

const emitter = new EventEmitter();

describe('测试Emitter事件', () => {
    it('测试debug函数', () => {
        emitter.$on('emitter:logger', (level, title) => {
            if (level === 'debug') {
                equal(title, 'title');
            }
        });
        emitter.$debug('title');
    });
    it('测试error函数', () => {
        emitter.$on('emitter:logger', (level, title) => {
            if (level === 'error') {
                equal(title, 'title');
            }
        });
        emitter.$error('title');
    });
    it('测试success函数', () => {
        emitter.$on('emitter:logger', (level, title) => {
            if (level === 'success') {
                equal(title, 'title');
            }
        });
        emitter.$success('title');
    });
    it('测试warn函数', () => {
        emitter.$on('emitter:logger', (level, title) => {
            if (level === 'warn') {
                equal(title, 'title');
            }
        });
        emitter.$warn('title');
    });
    it('测试log函数', () => {
        emitter.$on('emitter:logger', (level, title) => {
            if (level === 'log') {
                equal(title, 'title');
            }
        });
        emitter.$log('title');
    });
});
