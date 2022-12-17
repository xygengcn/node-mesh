const typescript = require('rollup-plugin-typescript2');
const dts = require('rollup-plugin-dts');

module.exports = [
    {
        input: './src/index.ts',
        output: [
            {
                dir: './dist',
                format: 'cjs',
                entryFileNames: '[name].js'
            },
            {
                dir: './dist',
                format: 'esm',
                entryFileNames: '[name].esm.js'
            }
        ],
        plugins: [
            typescript({
                tsconfig: './tsconfig.build.json'
            })
        ]
    },
    {
        input: './src/index.ts',
        output: [{ dir: './dist', format: 'es' }],
        plugins: [dts.default()]
    }
];
