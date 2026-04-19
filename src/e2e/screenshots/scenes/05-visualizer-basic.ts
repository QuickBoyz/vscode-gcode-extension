import { WebDriver } from 'selenium-webdriver';

import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import { VISUALIZER_CROP } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';
import { WebviewReadyWaiter } from '../lib/WebviewReadyWaiter';

const VISUALIZER_OPEN_DELAY_MS = 3000;

export class VisualizerBasicScene extends Scene {
  readonly outputPath = 'images/screenshots/05-visualizer-basic.png';
  readonly fixture = 'fixtures/screenshots/basic-3d.nc';
  readonly cropRegion = VISUALIZER_CROP;

  async interact(driver: WebDriver): Promise<void> {
    await CommandPaletteRunner.runCommand(driver, 'gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);
    await WebviewReadyWaiter.waitUntilReady(driver);
  }
}
