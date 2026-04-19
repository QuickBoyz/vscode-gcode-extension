import { WebDriver } from 'selenium-webdriver';
import { Workbench } from 'vscode-extension-tester';

import { VISUALIZER_CROP } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';
import { WebviewReadyWaiter } from '../lib/WebviewReadyWaiter';

const VISUALIZER_OPEN_DELAY_MS = 2000;

export class VisualizerBasicScene extends Scene {
  readonly outputPath = 'images/screenshots/05-visualizer-basic.png';
  readonly fixture = 'fixtures/screenshots/basic-3d.nc';
  readonly cropRegion = VISUALIZER_CROP;

  async interact(driver: WebDriver): Promise<void> {
    const bench = new Workbench();
    await bench.executeCommand('gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);
    await WebviewReadyWaiter.waitUntilReady(driver);
  }
}
