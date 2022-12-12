/**
 * 环境量配置
 */

module.exports = {
    development: {
        NODE_ENV: 'development',
        DEBUG_LEVEL: 0
    },
    test: {
        NODE_ENV: 'test',
        TS_NODE_PROJECT: 'test/tsconfig.test.json',
        DEBUG_LEVEL: 100
    },
    sit: {
        NODE_ENV: 'sit',
        DEBUG_LEVEL: 100
    },
    production: {
        NODE_ENV: 'production',
        DEBUG_LEVEL: 100
    }
};
