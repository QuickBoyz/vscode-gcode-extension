import * as path from 'path';

import { VSBrowser } from 'vscode-extension-tester';

import { SceneRunner } from './lib/SceneRunner';
import { createAllScenes } from './scenes/index';

const SUITE_TIMEOUT_MS = 300_000;

const repoRoot = path.resolve(__dirname, '..', '..', '..');

suite('Screenshot pipeline', function () {
  this.timeout(SUITE_TIMEOUT_MS);

  test('Capture all scenes', async function () {
    const driver = VSBrowser.instance.driver;
    // The xvfb virtual display is sized to 1920x1080 via `--server-args`.
    // Selenium's `setRect` / `maximize` both map to CDP `Browser.getWindowForTarget`,
    // which VS Code's Electron build does not expose. `window.resizeTo()` is a
    // plain DOM call that Electron's BrowserWindow honors, so we use it directly.
    try {
      await driver.executeScript('window.moveTo(0, 0); window.resizeTo(1920, 1080);');
    } catch (error) {
      console.warn('[screenshot] window.resizeTo failed, using xvfb default:', error);
    }

    const scenes = createAllScenes(repoRoot);
    const runner = new SceneRunner(scenes);
    const exitCode = await runner.run(driver);

    if (exitCode !== 0) {
      throw new Error('One or more screenshot scenes failed — see console output above');
    }
  });
});
