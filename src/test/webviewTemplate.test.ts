import * as fs from 'fs';
import * as path from 'path';
import { generateNonce } from '../client/nonce';

describe('generateNonce', () => {
  it('returns a 32-character hex string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique values', () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(nonces.size).toBe(100);
  });
});

describe('webview static files', () => {
  const webviewDir = path.join(__dirname, '..', 'webview');

  it('index.html contains required placeholders', () => {
    const html = fs.readFileSync(path.join(webviewDir, 'index.html'), 'utf-8');
    expect(html).toContain('{{nonce}}');
    expect(html).toContain('{{scriptUri}}');
    expect(html).toContain('{{styleUri}}');
    expect(html).toContain('{{cspSource}}');
    expect(html).toContain('id="canvas"');
  });

  it('styles.css exists and is non-empty', () => {
    const css = fs.readFileSync(path.join(webviewDir, 'styles.css'), 'utf-8');
    expect(css.length).toBeGreaterThan(100);
    expect(css).toContain('--vscode-editor-background');
  });
});
