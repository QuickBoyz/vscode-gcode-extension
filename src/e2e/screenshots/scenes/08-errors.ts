import { WebDriver } from 'selenium-webdriver';
import { Workbench } from 'vscode-extension-tester';

import { CropRegion, Scene } from '../lib/Scene';

/** Editor + Problems panel below — full editor column, no sidebar. */
const EDITOR_CROP: CropRegion = { left: 48, top: 35, width: 1872, height: 1023 };

const PANEL_SETTLE_MS = 1000;

export class ErrorsScene extends Scene {
  readonly outputPath = 'images/screenshots/08-errors.png';
  readonly fixture = 'fixtures/malformed.nc';
  readonly cropRegion = EDITOR_CROP;

  async interact(driver: WebDriver): Promise<void> {
    // Open the Problems panel so diagnostics are visible.
    const bench = new Workbench();
    await bench.executeCommand('workbench.actions.view.problems');
    await driver.sleep(PANEL_SETTLE_MS);
  }
}
