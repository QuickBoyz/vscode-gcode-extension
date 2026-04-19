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
    await driver.manage().window().setSize(1920, 1080);

    const scenes = createAllScenes(repoRoot);
    const runner = new SceneRunner(scenes);
    const exitCode = await runner.run(driver);

    if (exitCode !== 0) {
      throw new Error('One or more screenshot scenes failed — see console output above');
    }
  });
});
