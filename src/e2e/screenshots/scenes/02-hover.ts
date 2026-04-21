import { Key, WebDriver } from 'selenium-webdriver';
import { TextEditor } from 'vscode-extension-tester';

import { EDITOR_HEIGHT, EDITOR_START_TOP, EDITOR_WIDTH, LEFT_PANEL_LEFT } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';

const HOVER_SETTLE_MS = 1500;
const CROP_REGION = {
  top: EDITOR_START_TOP,
  left: LEFT_PANEL_LEFT,
  width: Math.floor(EDITOR_WIDTH / 4),
  height: Math.floor(EDITOR_HEIGHT / 2),
};

export class HoverScene extends Scene {
  readonly outputPath = 'images/screenshots/02-hover.png';
  readonly fixture = 'fixtures/complex.nc';
  readonly cropRegion = CROP_REGION;

  async interact(driver: WebDriver): Promise<void> {
    // Land the cursor on a G-code word that has rich hover docs. Line 2 of
    // complex.nc is `G21 G90 G54`; positioning after column 1 places the cursor
    // inside `G21` so the hover widget resolves to the G21 reference entry.
    const editor = new TextEditor();
    await editor.moveCursor(2, 2);

    // `editor.action.showHover` is bound to `Ctrl+K Ctrl+I` in VS Code. The
    // previous `Shift+F1` binding is unrelated to hover — F1 alone opens the
    // command palette, and the Shift modifier was dropped in Selenium's chord
    // path, which is why prior captures showed the palette instead of a tooltip.
    await driver
      .actions()
      .keyDown(Key.CONTROL)
      .sendKeys('k')
      .keyUp(Key.CONTROL)
      .keyDown(Key.CONTROL)
      .sendKeys('i')
      .keyUp(Key.CONTROL)
      .perform();
    await driver.sleep(HOVER_SETTLE_MS);
  }
}
