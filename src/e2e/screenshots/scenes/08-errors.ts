import { WebDriver } from 'selenium-webdriver';

import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import { EDITOR_CROP } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';

const PANEL_SETTLE_MS = 1500;

export class ErrorsScene extends Scene {
  readonly outputPath = 'images/screenshots/08-errors.png';
  readonly fixture = 'fixtures/malformed.nc';
  readonly cropRegion = EDITOR_CROP;

  async interact(driver: WebDriver): Promise<void> {
    // Open the Problems panel so diagnostics are visible.
    await CommandPaletteRunner.runCommand(driver, 'workbench.actions.view.problems');
    await driver.sleep(PANEL_SETTLE_MS);
  }
}
