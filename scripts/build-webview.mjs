import { copyFileSync, mkdirSync, writeFileSync, watch as fsWatch } from 'fs';
import { build, context } from 'esbuild';
import * as sass from 'sass';


const isWatch = process.argv.includes('--watch');

function buildSass() {
  const result = sass.compile('src/webview/styles.scss');
  writeFileSync('dist/webview/styles.css', result.css);
}

function copyHtml() {
  copyFileSync('src/webview/index.html', 'dist/webview/index.html');
}

mkdirSync('dist/webview', { recursive: true });

const esbuildOptions = {
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  outfile: 'dist/webview/renderer.js',
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
  tsconfig: 'tsconfig.webview.json',
};

if (isWatch) {
  const ctx = await context(esbuildOptions);
  await ctx.watch();
  console.log('Watching for changes...');

  copyHtml();
  buildSass();

  for (const dir of ['src/webview']) {
    fsWatch(dir, { recursive: true }, (_event, filename) => {
      if (filename?.endsWith('.html')) {
        copyHtml();
        console.log('Rebuilt HTML.');
      }
      if (filename?.endsWith('.scss')) {
        buildSass();
        console.log('Rebuilt SCSS.');
      }
    });
  }
} else {
  await build(esbuildOptions);
  copyHtml();
  buildSass();
  console.log('Webview build complete.');
}
