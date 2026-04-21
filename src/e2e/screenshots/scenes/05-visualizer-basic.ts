import { WebDriver } from 'selenium-webdriver';

import { CommandPaletteRunner } from '../lib/CommandPaletteRunner';
import {
  EDITOR_HEIGHT,
  EDITOR_START_TOP,
  EDITOR_WIDTH,
  LEFT_PANEL_LEFT,
  RIGHT_PANEL_LEFT,
} from '../lib/cropRegions';
import { Scene } from '../lib/Scene';
import { WebviewReadyWaiter } from '../lib/WebviewReadyWaiter';

const VISUALIZER_OPEN_DELAY_MS = 3000;

const CROP_REGION = {
  top: EDITOR_START_TOP,
  left: RIGHT_PANEL_LEFT,
  width: EDITOR_WIDTH + LEFT_PANEL_LEFT - RIGHT_PANEL_LEFT,
  height: EDITOR_HEIGHT,
};

export class VisualizerBasicScene extends Scene {
  readonly outputPath = 'images/screenshots/05-visualizer-basic.png';
  readonly fixture = 'fixtures/screenshots/basic-3d.nc';
  readonly cropRegion = CROP_REGION;

  async interact(driver: WebDriver): Promise<void> {
    await CommandPaletteRunner.runCommand(driver, 'gcode.openVisualizer');
    await driver.sleep(VISUALIZER_OPEN_DELAY_MS);
    await WebviewReadyWaiter.waitUntilReady(driver);
  }
}
