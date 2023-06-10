const typescript = require('rollup-plugin-ts');
const tscAlias = require('rollup-plugin-tsc-alias');

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
            }),
            tscAlias()
        ]
    }
];
