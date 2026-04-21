import { WebDriver } from 'selenium-webdriver';

import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import { Scene } from '../lib/Scene';
import { WebviewReadyWaiter } from '../lib/WebviewReadyWaiter';

const LAYOUT_SETTLE_MS = 1500;
const VISUALIZER_OPEN_DELAY_MS = 3000;
const WORKSPACE_SETTLE_MS = 2000;

/** Full-window hero shot: editor-left, visualizer-right, Explorer sidebar open. */
export class HeroScene extends Scene {
  readonly outputPath = 'images/screenshots/11-hero.png';
  readonly fixture = 'fixtures/screenshots/hero.nc';
  readonly cropRegion = null; // full window, no crop

  async interact(driver: WebDriver): Promise<void> {
    // Add the fixtures directory as a workspace folder so that Explorer shows a
    // file tree instead of "NO FOLDER OPENED". The extension command reads the
    // target path from a temp file written by VSCodeLauncher. VS Code 1.64+
    // handles adding the first workspace folder without reloading the window.
    await CommandPaletteRunner.runCommand(driver, 'gcode.e2eAddWorkspaceFolder');
    await driver.sleep(WORKSPACE_SETTLE_MS);

    // Ensure Explorer sidebar is open and showing the workspace files.
    await CommandPaletteRunner.runCommand(driver, 'workbench.view.explorer');
    await driver.sleep(LAYOUT_SETTLE_MS);

    // Open the visualizer panel beside the editor.
    await CommandPaletteRunner.runCommand(driver, 'gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);

    // Wait for the 3D content to render.
    await WebviewReadyWaiter.waitUntilReady(driver);
    await driver.sleep(LAYOUT_SETTLE_MS);
  }
}
