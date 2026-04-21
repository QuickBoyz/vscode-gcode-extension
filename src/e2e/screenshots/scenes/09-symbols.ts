import { WebDriver } from 'selenium-webdriver';

import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import { CropRegion, Scene } from '../lib/Scene';

const OUTLINE_SETTLE_MS = 1000;
const QUICKPICK_SETTLE_MS = 1000;
const OUTLINE_CROP = { left: 0, top: 35, width: 500, height: 1023 };

/**
 * Two-PNG scene: `09a-symbols-outline.png` (Outline sidebar) and
 * `09b-symbols-quickpick.png` (Go-to-Symbol modal).
 */
export class SymbolsScene extends Scene {
  outputPath = 'images/screenshots/09a-symbols-outline.png';
  // variables.nc is a clean, valid fixture with three named parameters
  // (#<counter>, #<var>, #<result>) and a WHILE block — rich outline without
  // the "ERROR: …" placeholder comments that complex.nc ships for the errors
  // scene.
  readonly fixture = 'fixtures/variables.nc';
  cropRegion: CropRegion | null = OUTLINE_CROP;

  override async capture(driver: WebDriver): Promise<void> {
    // ── 09a: Outline sidebar ──────────────────────────────────────────
    await CommandPaletteRunner.runCommand(driver, 'outline.focus');
    await driver.sleep(OUTLINE_SETTLE_MS);

    await super.capture(driver);

    // ── 09b: Go-to-Symbol quick-pick ──────────────────────────────────
    await CommandPaletteRunner.runCommand(driver, 'workbench.action.gotoSymbol');
    await driver.sleep(QUICKPICK_SETTLE_MS);

    this.cropRegion = null;
    this.outputPath = 'images/screenshots/09b-symbols-quickpick.png';
    await super.capture(driver);
  }
}
