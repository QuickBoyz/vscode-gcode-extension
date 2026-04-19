import { WebDriver } from 'selenium-webdriver';
import { Workbench } from 'vscode-extension-tester';

import { CropRegion, Scene } from '../lib/Scene';
import { WebviewReadyWaiter } from '../lib/WebviewReadyWaiter';

const VISUALIZER_CROP: CropRegion = { left: 1000, top: 35, width: 920, height: 1023 };

const VISUALIZER_OPEN_DELAY_MS = 2000;

export class VisualizerComplexScene extends Scene {
  readonly outputPath = 'images/screenshots/06-visualizer-complex.png';
  readonly fixture = 'fixtures/screenshots/complex-3d.nc';
  readonly cropRegion = VISUALIZER_CROP;

  async interact(driver: WebDriver): Promise<void> {
    const bench = new Workbench();
    await bench.executeCommand('gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);
    await WebviewReadyWaiter.waitUntilReady(driver);
  }
}
