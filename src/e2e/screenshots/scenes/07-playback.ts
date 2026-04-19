import { WebDriver } from 'selenium-webdriver';
import { WebView } from 'vscode-extension-tester';

import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import { VISUALIZER_CROP } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';
import { WebviewReadyWaiter } from '../lib/WebviewReadyWaiter';

const VISUALIZER_OPEN_DELAY_MS = 3000;
const SEEK_SETTLE_MS = 500;
const FRAME_SWITCH_TIMEOUT_MS = 10_000;

export class PlaybackScene extends Scene {
  readonly outputPath = 'images/screenshots/07-playback.png';
  readonly fixture = 'fixtures/screenshots/playback.nc';
  readonly cropRegion = VISUALIZER_CROP;

  async interact(driver: WebDriver): Promise<void> {
    await CommandPaletteRunner.runCommand(driver, 'gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);
    await WebviewReadyWaiter.waitUntilReady(driver);

    // Read totalSegments from the webview and seek to 60%.
    const totalSegments = await WebviewReadyWaiter.readTotalSegments(driver);
    const seekIndex = Math.round(totalSegments * 0.6);

    // Post playback control messages directly to the webview window.
    const webview = new WebView();
    await webview.switchToFrame(FRAME_SWITCH_TIMEOUT_MS);
    try {
      await driver.executeScript(
        `window.postMessage({ type: 'playbackControl', action: 'seekToSegment', index: ${seekIndex} }, '*')`
      );
      await driver.sleep(100);
      await driver.executeScript(
        `window.postMessage({ type: 'playbackControl', action: 'pause' }, '*')`
      );
      await driver.sleep(SEEK_SETTLE_MS);
    } finally {
      await webview.switchBack();
    }
  }
}
