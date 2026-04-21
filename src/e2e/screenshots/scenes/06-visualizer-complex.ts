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

// Surface-finish is ~3.1 MB and produces ~10x the segments of the small
// curated fixtures. The webview needs longer to build its Three.js geometry
// before it flips `__gcodeVisualizerReady`, so we extend the initial delay.
const VISUALIZER_OPEN_DELAY_MS = 6000;
const FRAME_SWITCH_TIMEOUT_MS = 10_000;
const CAMERA_RESET_SETTLE_MS = 500;

const CROP_REGION = {
  top: EDITOR_START_TOP,
  left: RIGHT_PANEL_LEFT,
  width: EDITOR_WIDTH + LEFT_PANEL_LEFT - RIGHT_PANEL_LEFT,
  height: EDITOR_HEIGHT,
};

export class VisualizerComplexScene extends Scene {
  readonly outputPath = 'images/screenshots/06-visualizer-complex.png';
  // Reuse the benchmark fixture (surface-finish.ngc from src/test/fixtures) so
  // the "complex" scene actually showcases a realistic multi-pass surface-finish
  // toolpath rather than a toy 60-line program. The `../test/fixtures/` escape
  // avoids duplicating the 3 MB fixture into `src/e2e/fixtures/screenshots/`.
  readonly fixture = '../test/fixtures/surface-finish.ngc';
  readonly cropRegion = CROP_REGION;

  async interact(driver: WebDriver): Promise<void> {
    await CommandPaletteRunner.runCommand(driver, 'gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);
    await WebviewReadyWaiter.waitUntilReady(driver);

    // Explicitly reset the camera after the ready signal to ensure the full
    // model is framed. The initial fitView in VisualizerContext may have been
    // skipped if camera controls were not yet registered when the update
    // message arrived (race between large-file parse and canvas mount).
    const webview = new WebView();
    await webview.switchToFrame(FRAME_SWITCH_TIMEOUT_MS);
    try {
      await driver.executeScript(
        `window.postMessage({ type: 'cameraControl', action: 'resetView' }, '*')`
      );
      await driver.sleep(CAMERA_RESET_SETTLE_MS);
    } finally {
      await webview.switchBack();
    }
  }
}
