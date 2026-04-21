import { WebDriver } from 'selenium-webdriver';

import { EDITOR_HEIGHT, EDITOR_START_TOP, EDITOR_WIDTH, LEFT_PANEL_LEFT } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';

const CROP_REGION = {
  top: EDITOR_START_TOP,
  left: LEFT_PANEL_LEFT,
  width: Math.floor(EDITOR_WIDTH / 4),
  height: Math.floor(EDITOR_HEIGHT / 2),
};

export class SyntaxScene extends Scene {
  readonly outputPath = 'images/screenshots/01-syntax.png';
  readonly fixture = 'fixtures/complex.nc';
  readonly cropRegion = CROP_REGION;

  async interact(_driver: WebDriver): Promise<void> {
    // Just open the file — syntax highlighting is always visible.
  }
}
