const typescript = require('rollup-plugin-typescript2');
const { terser } = require('rollup-plugin-terser');
const copy = require('rollup-plugin-copy');
const dts = require('rollup-plugin-dts');

module.exports = [
  {
    input: {
      'content-script': './src/content-script/index.ts',
      panel: './src/panel/index.ts',
      preload: './src/preload/index.ts',
      'service-worker': './src/service-worker/index.ts'
    },
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
      typescript(),
      terser(),
      copy({
        targets: [
          {
            src: ['./manifest.json', './manifest_v3.json', 'readmde.md', 'package.json'],
            dest: './dist/'
          }
        ]
      })
    ]
  },
  {
    input: {
      'content-script': './examples/content-script.ts',
      'devtools-page': './src/devtools-page/index.ts',
      panel: './examples/panel.ts',
      preload: './examples/preload.ts',
      'service-worker': './examples/service-worker.ts'
    },
    output: [
      {
        dir: './dist-test',
        format: 'cjs',
        entryFileNames: '[name].js'
      }
    ],
    plugins: [
      typescript(),
      terser(),
      copy({
        targets: [
          {
            src: ['./manifest.json', './examples/devtools-page.html', './examples/panel.html', './examples/index.html'],
            dest: './dist-test/'
          }
        ]
      })
    ],
    external: []
  },
  {
    input: {
      'content-script': './src/content-script/index.ts',
      panel: './src/panel/index.ts',
      preload: './src/preload/index.ts',
      'service-worker': './src/service-worker/index.ts'
    },
    output: [{ dir: './dist', format: 'es' }],
    plugins: [dts.default()]
  }
];
