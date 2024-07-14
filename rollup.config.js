const typescript = require('rollup-plugin-typescript2');
const commonjs = require('@rollup/plugin-commonjs');
const resolve = require('@rollup/plugin-node-resolve');
const copy = require('rollup-plugin-copy');

module.exports = {
  input: 'src/index.tsx',
  output: [
    {
      file: 'dist/index.js',
      format: 'esm',
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: 'tsconfig.json',
      useTsconfigDeclarationDir: true,
    }),
    copy({
      targets: [
        {
          src: 'src/types.d.ts',
          dest: 'dist'
        }
      ]
    })
  ],
  external: [
    'react',
    'react-dom',
    'fast-equals'
  ],
};
