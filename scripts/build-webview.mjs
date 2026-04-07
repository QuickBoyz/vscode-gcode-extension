import { copyFileSync, mkdirSync, writeFileSync } from 'fs';
import { build } from 'esbuild';
import * as sass from 'sass';

await build({
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  outfile: 'dist/webview/renderer.js',
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
  tsconfig: 'tsconfig.webview.json',
});

mkdirSync('dist/webview', { recursive: true });
copyFileSync('src/webview/index.html', 'dist/webview/index.html');

const result = sass.compile('src/webview/styles.scss');
writeFileSync('dist/webview/styles.css', result.css);

console.log('Webview build complete.');
