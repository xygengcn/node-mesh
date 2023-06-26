const typescript = require('rollup-plugin-ts');
const tscAlias = require('rollup-plugin-tsc-alias');
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

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
            commonjs(),
            typescript({
                tsconfig: './tsconfig.build.json'
            }),
            resolve(),
            tscAlias()
        ]
    }
];
