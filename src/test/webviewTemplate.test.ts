import { generateNonce, buildWebviewHtml } from '../client/webviewTemplate';
import { DEFAULT_VISUALIZER_SETTINGS } from '../visualizer/types';

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

describe('buildWebviewHtml', () => {
  it('returns a string containing expected HTML elements', () => {
    const nonce = generateNonce();
    const html = buildWebviewHtml(nonce, DEFAULT_VISUALIZER_SETTINGS);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(`nonce-${nonce}`);
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).toContain('<canvas id="canvas">');
    expect(html).toContain('G-Code 3D Visualizer');
  });

  it('embeds the provided settings values', () => {
    const nonce = generateNonce();
    const settings = {
      rapidColor: '#ff0000',
      feedColor: '#00ff00',
      arcColor: '#0000ff',
      lineThickness: 2.5,
    };
    const html = buildWebviewHtml(nonce, settings);

    expect(html).toContain(`value="${settings.rapidColor}"`);
    expect(html).toContain(`value="${settings.feedColor}"`);
    expect(html).toContain(`value="${settings.arcColor}"`);
    expect(html).toContain(`value="${settings.lineThickness}"`);
  });
});
