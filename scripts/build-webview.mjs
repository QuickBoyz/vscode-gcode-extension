import { copyFileSync, mkdirSync } from 'fs';
import { build } from 'esbuild';

await build({
  entryPoints: ['src/webview/renderer.ts'],
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
copyFileSync('src/webview/styles.css', 'dist/webview/styles.css');

console.log('Webview build complete.');
