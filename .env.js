/**
 * 环境量配置
 */

module.exports = {
    development: {
        NODE_ENV: 'development'
    },
    test: {
        NODE_ENV: 'test',
        TS_NODE_PROJECT: 'test/tsconfig.test.json'
    },
    sit: {
        NODE_ENV: 'sit'
    },
    production: {
        NODE_ENV: 'production'
    }
};
