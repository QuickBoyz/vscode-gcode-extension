import { WebDriver } from 'selenium-webdriver';
import { WebView } from 'vscode-extension-tester';

import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import {
  EDITOR_HEIGHT,
  EDITOR_START_TOP,
  EDITOR_WIDTH,
  LEFT_PANEL_LEFT,
  RIGHT_PANEL_LEFT,
} from '../lib/cropRegions';
import { Scene } from '../lib/Scene';
import { WebviewReadyWaiter } from '../lib/WebviewReadyWaiter';

// See VisualizerComplexScene — surface-finish.ngc is large enough that the
// Three.js build phase pushes past the 3 s delay we used for the small fixtures.
const VISUALIZER_OPEN_DELAY_MS = 6000;
const SEEK_SETTLE_MS = 500;
const FRAME_SWITCH_TIMEOUT_MS = 10_000;

const CROP_REGION = {
  top: EDITOR_START_TOP,
  left: RIGHT_PANEL_LEFT,
  width: EDITOR_WIDTH + LEFT_PANEL_LEFT - RIGHT_PANEL_LEFT,
  height: EDITOR_HEIGHT,
};

export class PlaybackScene extends Scene {
  readonly outputPath = 'images/screenshots/07-playback.png';
  // Use the same benchmark fixture as the complex visualizer scene so playback
  // seek lands on a visually rich toolpath (completed trail + ghosted remainder
  // at 60%). Relative-path escape shares the fixture with `src/test/fixtures`
  // without duplicating the 3 MB file into `src/e2e/fixtures/screenshots/`.
  readonly fixture = '../test/fixtures/surface-finish.ngc';
  readonly cropRegion = CROP_REGION;

  async interact(driver: WebDriver): Promise<void> {
    await CommandPaletteRunner.runCommand(driver, 'gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);
    await WebviewReadyWaiter.waitUntilReady(driver);

    // Read totalSegments from the webview and seek to 60%.
    const totalSegments = await WebviewReadyWaiter.readTotalSegments(driver);
    const seekIndex = Math.round(totalSegments * 0.6);

    // Post playback and camera control messages directly to the webview window.
    const webview = new WebView();
    await webview.switchToFrame(FRAME_SWITCH_TIMEOUT_MS);
    try {
      // Reset the camera first to ensure the full model is framed (same race
      // condition as VisualizerComplexScene — see that scene for details).
      await driver.executeScript(
        `window.postMessage({ type: 'cameraControl', action: 'resetView' }, '*')`
      );
      await driver.sleep(100);
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
