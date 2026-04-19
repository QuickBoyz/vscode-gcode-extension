import * as fs from 'fs';
import * as path from 'path';

import { WebDriver } from 'selenium-webdriver';
import { Workbench } from 'vscode-extension-tester';

import { Capture } from '../lib/Capture';
import { CropRegion, Scene } from '../lib/Scene';

/** Outline sidebar + editor together. */
const OUTLINE_CROP: CropRegion = { left: 0, top: 35, width: 500, height: 1023 };
/** Editor with the Go-to-Symbol quick-pick overlay. */
const QUICKPICK_CROP: CropRegion = { left: 48, top: 35, width: 1872, height: 1023 };

const OUTLINE_SETTLE_MS = 1000;
const QUICKPICK_SETTLE_MS = 1000;

/**
 * Two-PNG scene: `09a-symbols-outline.png` (Outline sidebar) and
 * `09b-symbols-quickpick.png` (Go-to-Symbol modal).
 */
export class SymbolsScene extends Scene {
  readonly outputPath = 'images/screenshots/09a-symbols-outline.png';
  readonly fixture = 'fixtures/complex.nc';
  readonly cropRegion = OUTLINE_CROP;

  override async capture(driver: WebDriver): Promise<void> {
    // ── 09a: Outline sidebar ──────────────────────────────────────────
    const bench = new Workbench();
    await bench.executeCommand('outline.focus');
    await driver.sleep(OUTLINE_SETTLE_MS);

    const outlinePng = await driver.takeScreenshot();
    const outlineBuffer = Buffer.from(outlinePng, 'base64');
    const outlineAbs = path.resolve(this.repoRoot, this.outputPath);
    fs.mkdirSync(path.dirname(outlineAbs), { recursive: true });
    await Capture.cropAndWrite(outlineBuffer, OUTLINE_CROP, outlineAbs);

    // ── 09b: Go-to-Symbol quick-pick ──────────────────────────────────
    await bench.executeCommand('workbench.action.gotoSymbol');
    await driver.sleep(QUICKPICK_SETTLE_MS);

    const qpPng = await driver.takeScreenshot();
    const qpBuffer = Buffer.from(qpPng, 'base64');
    const qpAbs = path.resolve(this.repoRoot, 'images/screenshots/09b-symbols-quickpick.png');
    await Capture.cropAndWrite(qpBuffer, QUICKPICK_CROP, qpAbs);
  }
}
