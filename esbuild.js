const esbuild = require('esbuild');
const watch = process.argv.includes('--watch');

const ctx = esbuild.context({
  entryPoints: ['src/extension.ts', 'src/cli.ts'],
  bundle: true,
  outdir: 'dist',
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
});

ctx.then(c => watch ? c.watch() : c.rebuild().then(() => { console.log('Build done'); c.dispose(); }))
   .catch(() => process.exit(1));
