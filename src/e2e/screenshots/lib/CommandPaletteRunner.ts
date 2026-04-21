import { Key, WebDriver } from 'selenium-webdriver';

const PALETTE_OPEN_SETTLE_MS = 500;
const AFTER_CLEAR_SETTLE_MS = 100;
const AFTER_TYPE_SETTLE_MS = 600;

/**
 * Opens the VS Code command palette via raw keyboard input and runs a command
 * (or opens a file via Quick Open).
 *
 * Why this exists instead of `Workbench.executeCommand`:
 * monaco-page-objects' `openCommandPrompt` detects the presence of ANY webview
 * in the editor area and falls back to sending `F1` to the active tab's DOM
 * element. That path is unreliable — once the visualizer webview tab has been
 * created, every subsequent command-palette interaction times out waiting for
 * the input box. Sending `Ctrl+Shift+P` at the driver level instead routes
 * through VS Code's global keybindings and works regardless of the open tabs.
 *
 * We explicitly switch back to the default content before sending keys so that
 * a residual webview iframe focus from a prior scene does not capture them,
 * and we always clear any pre-filled prefix (Ctrl+Shift+P auto-inserts `>`)
 * before typing the actual target.
 */
export class CommandPaletteRunner {
  /** Runs a command by id (or title). Opens the palette and types `>` + id. */
  static async runCommand(driver: WebDriver, commandId: string): Promise<void> {
    await this.openPaletteClearInput(driver);
    await driver.actions().sendKeys(`>${commandId}`).perform();
    await driver.sleep(AFTER_TYPE_SETTLE_MS);
    await driver.actions().sendKeys(Key.RETURN).perform();
  }

  /** Opens a file via Quick Open (no prefix). */
  static async openFile(driver: WebDriver, absolutePath: string): Promise<void> {
    await this.openPaletteClearInput(driver);
    await driver.actions().sendKeys(absolutePath).perform();
    await driver.sleep(AFTER_TYPE_SETTLE_MS);
    await driver.actions().sendKeys(Key.RETURN).perform();
  }

  private static async openPaletteClearInput(driver: WebDriver): Promise<void> {
    await driver.switchTo().defaultContent();

    // Ctrl+Shift+P opens the palette with a `>` prefix already typed. We always
    // clear whatever is in the input so the caller can type exactly what they
    // want (with or without `>`).
    await driver
      .actions()
      .keyDown(Key.CONTROL)
      .keyDown(Key.SHIFT)
      .sendKeys('p')
      .keyUp(Key.SHIFT)
      .keyUp(Key.CONTROL)
      .perform();
    await driver.sleep(PALETTE_OPEN_SETTLE_MS);

    await driver
      .actions()
      .keyDown(Key.CONTROL)
      .sendKeys('a')
      .keyUp(Key.CONTROL)
      .sendKeys(Key.DELETE)
      .perform();
    await driver.sleep(AFTER_CLEAR_SETTLE_MS);
  }
}
