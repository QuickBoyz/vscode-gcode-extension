import { Key, WebDriver } from 'selenium-webdriver';
import { TextEditor } from 'vscode-extension-tester';

import { EDITOR_HEIGHT, EDITOR_START_TOP, EDITOR_WIDTH, LEFT_PANEL_LEFT } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';

const COMPLETION_SETTLE_MS = 1500;
const CROP_REGION = {
  top: EDITOR_START_TOP,
  left: LEFT_PANEL_LEFT,
  width: Math.floor(EDITOR_WIDTH / 4),
  height: Math.floor(EDITOR_HEIGHT / 2),
};

export class CompletionScene extends Scene {
  readonly outputPath = 'images/screenshots/03-completion.png';
  readonly fixture = 'fixtures/complex.nc';
  readonly cropRegion = CROP_REGION;

  async interact(driver: WebDriver): Promise<void> {
    const editor = new TextEditor();
    // Move to a line with G-code content and trigger completions.
    await editor.moveCursor(1, 1);
    await editor
      .getDriver()
      .actions()
      .keyDown(Key.CONTROL)
      .sendKeys(' ')
      .keyUp(Key.CONTROL)
      .perform();
    await driver.sleep(COMPLETION_SETTLE_MS);
  }
}
