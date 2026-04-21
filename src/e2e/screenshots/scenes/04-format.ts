import { WebDriver } from 'selenium-webdriver';

import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import { EDITOR_HEIGHT, EDITOR_START_TOP, EDITOR_WIDTH, LEFT_PANEL_LEFT } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';

const FORMAT_SETTLE_MS = 1500;

const CROP_REGION = {
  top: EDITOR_START_TOP,
  left: LEFT_PANEL_LEFT,
  width: Math.floor(EDITOR_WIDTH / 4),
  height: Math.floor(EDITOR_HEIGHT / 4),
};

/**
 * Two-PNG scene: captures `04a-format-before.png` then formats the document
 * and captures `04b-format-after.png`. The SceneRunner's `capture()` call is
 * overridden to produce both PNGs in one pass.
 */
export class FormatScene extends Scene {
  readonly fixture = 'fixtures/variables.nc';
  readonly cropRegion = CROP_REGION;
  outputPath = 'images/screenshots/04a-format-before.png';

  override async capture(driver: WebDriver): Promise<void> {
    // ── Before ────────────────────────────────────────────────────────
    await super.capture(driver);

    // ── Format ────────────────────────────────────────────────────────
    await CommandPaletteRunner.runCommand(driver, 'editor.action.formatDocument');
    await driver.sleep(FORMAT_SETTLE_MS);

    // ── After ─────────────────────────────────────────────────────────
    this.outputPath = 'images/screenshots/04b-format-after.png';
    await super.capture(driver);
  }
}
