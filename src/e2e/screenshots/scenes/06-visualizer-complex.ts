import { WebDriver } from 'selenium-webdriver';

import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import { VISUALIZER_CROP } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';
import { WebviewReadyWaiter } from '../lib/WebviewReadyWaiter';

// Surface-finish is ~3.1 MB and produces ~10x the segments of the small
// curated fixtures. The webview needs longer to build its Three.js geometry
// before it flips `__gcodeVisualizerReady`, so we extend the initial delay.
const VISUALIZER_OPEN_DELAY_MS = 6000;

export class VisualizerComplexScene extends Scene {
  readonly outputPath = 'images/screenshots/06-visualizer-complex.png';
  // Reuse the benchmark fixture (surface-finish.ngc from src/test/fixtures) so
  // the "complex" scene actually showcases a realistic multi-pass surface-finish
  // toolpath rather than a toy 60-line program. The `../test/fixtures/` escape
  // avoids duplicating the 3 MB fixture into `src/e2e/fixtures/screenshots/`.
  readonly fixture = '../test/fixtures/surface-finish.ngc';
  readonly cropRegion = VISUALIZER_CROP;

  async interact(driver: WebDriver): Promise<void> {
    await CommandPaletteRunner.runCommand(driver, 'gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);
    await WebviewReadyWaiter.waitUntilReady(driver);
  }
}
