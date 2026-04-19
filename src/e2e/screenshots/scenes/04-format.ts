import * as fs from 'fs';
import * as path from 'path';

import { WebDriver } from 'selenium-webdriver';

import { Capture } from '../lib/Capture';
import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import { EDITOR_CROP } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';

const FORMAT_SETTLE_MS = 1500;

/**
 * Two-PNG scene: captures `04a-format-before.png` then formats the document
 * and captures `04b-format-after.png`. The SceneRunner's `capture()` call is
 * overridden to produce both PNGs in one pass.
 */
export class FormatScene extends Scene {
  readonly outputPath = 'images/screenshots/04a-format-before.png';
  readonly fixture = 'fixtures/variables.nc';
  readonly cropRegion = EDITOR_CROP;

  override async capture(driver: WebDriver): Promise<void> {
    // ── Before ────────────────────────────────────────────────────────
    const beforePng = await driver.takeScreenshot();
    const beforeBuffer = Buffer.from(beforePng, 'base64');
    const beforeAbs = path.resolve(this.repoRoot, this.outputPath);
    fs.mkdirSync(path.dirname(beforeAbs), { recursive: true });
    await Capture.cropAndWrite(beforeBuffer, EDITOR_CROP, beforeAbs);

    // ── Format ────────────────────────────────────────────────────────
    await CommandPaletteRunner.runCommand(driver, 'editor.action.formatDocument');
    await driver.sleep(FORMAT_SETTLE_MS);

    // ── After ─────────────────────────────────────────────────────────
    const afterPng = await driver.takeScreenshot();
    const afterBuffer = Buffer.from(afterPng, 'base64');
    const afterAbs = path.resolve(this.repoRoot, 'images/screenshots/04b-format-after.png');
    await Capture.cropAndWrite(afterBuffer, EDITOR_CROP, afterAbs);
  }
}
