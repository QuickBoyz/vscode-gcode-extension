import { Key } from 'selenium-webdriver';
import { TextEditor } from 'vscode-extension-tester';
import { WebDriver } from 'selenium-webdriver';

import { CropRegion, Scene } from '../lib/Scene';

const EDITOR_CROP: CropRegion = { left: 48, top: 35, width: 1872, height: 1023 };

const HOVER_SETTLE_MS = 1500;

export class HoverScene extends Scene {
  readonly outputPath = 'images/screenshots/02-hover.png';
  readonly fixture = 'fixtures/complex.nc';
  readonly cropRegion = EDITOR_CROP;

  async interact(driver: WebDriver): Promise<void> {
    const editor = new TextEditor();
    // Move cursor to line 1 and hover over the first G-code word to trigger hover docs.
    await editor.moveCursor(1, 1);
    // Trigger hover via keyboard shortcut (Shift+F1 = show hover / editor.action.showHover).
    await editor.getDriver().actions().sendKeys(Key.chord(Key.SHIFT, Key.F1)).perform();
    await driver.sleep(HOVER_SETTLE_MS);
  }
}
