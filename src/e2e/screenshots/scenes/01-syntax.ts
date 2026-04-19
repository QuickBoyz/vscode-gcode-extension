import { WebDriver } from 'selenium-webdriver';

import { CropRegion, Scene } from '../lib/Scene';

/** Editor pane: no sidebar, no chrome — richest token variety for theme showcase. */
const EDITOR_CROP: CropRegion = { left: 48, top: 35, width: 1872, height: 1023 };

export class SyntaxScene extends Scene {
  readonly outputPath = 'images/screenshots/01-syntax.png';
  readonly fixture = 'fixtures/complex.nc';
  readonly cropRegion = EDITOR_CROP;

  async interact(_driver: WebDriver): Promise<void> {
    // Just open the file — syntax highlighting is always visible.
  }
}
