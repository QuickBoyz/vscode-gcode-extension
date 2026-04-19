import * as fs from 'fs';
import * as path from 'path';

import { WebDriver } from 'selenium-webdriver';

import { Capture } from '../lib/Capture';
import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import { EDITOR_CROP, OUTLINE_CROP } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';

const OUTLINE_SETTLE_MS = 1000;
const QUICKPICK_SETTLE_MS = 1000;

/**
 * Two-PNG scene: `09a-symbols-outline.png` (Outline sidebar) and
 * `09b-symbols-quickpick.png` (Go-to-Symbol modal).
 */
export class SymbolsScene extends Scene {
  readonly outputPath = 'images/screenshots/09a-symbols-outline.png';
  // variables.nc is a clean, valid fixture with three named parameters
  // (#<counter>, #<var>, #<result>) and a WHILE block — rich outline without
  // the "ERROR: …" placeholder comments that complex.nc ships for the errors
  // scene.
  readonly fixture = 'fixtures/variables.nc';
  readonly cropRegion = OUTLINE_CROP;

  override async capture(driver: WebDriver): Promise<void> {
    // ── 09a: Outline sidebar ──────────────────────────────────────────
    await CommandPaletteRunner.runCommand(driver, 'outline.focus');
    await driver.sleep(OUTLINE_SETTLE_MS);

    const outlinePng = await driver.takeScreenshot();
    const outlineBuffer = Buffer.from(outlinePng, 'base64');
    const outlineAbs = path.resolve(this.repoRoot, this.outputPath);
    fs.mkdirSync(path.dirname(outlineAbs), { recursive: true });
    await Capture.cropAndWrite(outlineBuffer, OUTLINE_CROP, outlineAbs);

    // ── 09b: Go-to-Symbol quick-pick ──────────────────────────────────
    await CommandPaletteRunner.runCommand(driver, 'workbench.action.gotoSymbol');
    await driver.sleep(QUICKPICK_SETTLE_MS);

    const qpPng = await driver.takeScreenshot();
    const qpBuffer = Buffer.from(qpPng, 'base64');
    const qpAbs = path.resolve(this.repoRoot, 'images/screenshots/09b-symbols-quickpick.png');
    await Capture.cropAndWrite(qpBuffer, EDITOR_CROP, qpAbs);
  }
}
