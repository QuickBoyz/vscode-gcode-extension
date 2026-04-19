import { WebDriver } from 'selenium-webdriver';
import { Workbench } from 'vscode-extension-tester';

import { Scene } from '../lib/Scene';
import { WebviewReadyWaiter } from '../lib/WebviewReadyWaiter';

const LAYOUT_SETTLE_MS = 1500;
const VISUALIZER_OPEN_DELAY_MS = 2000;

/** Full-window hero shot: editor-left, visualizer-right, Explorer sidebar open. */
export class HeroScene extends Scene {
  readonly outputPath = 'images/screenshots/11-hero.png';
  readonly fixture = 'fixtures/screenshots/hero.nc';
  readonly cropRegion = null; // full window, no crop

  async interact(driver: WebDriver): Promise<void> {
    const bench = new Workbench();

    // Ensure Explorer sidebar is open.
    await bench.executeCommand('workbench.view.explorer');
    await driver.sleep(LAYOUT_SETTLE_MS);

    // Open the visualizer panel beside the editor.
    await bench.executeCommand('gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);

    // Wait for the 3D content to render.
    await WebviewReadyWaiter.waitUntilReady(driver);
    await driver.sleep(LAYOUT_SETTLE_MS);
  }
}
