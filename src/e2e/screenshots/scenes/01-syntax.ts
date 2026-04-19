import { WebDriver } from 'selenium-webdriver';

import { EDITOR_CROP } from '../lib/cropRegions';
import { Scene } from '../lib/Scene';

export class SyntaxScene extends Scene {
  readonly outputPath = 'images/screenshots/01-syntax.png';
  readonly fixture = 'fixtures/complex.nc';
  readonly cropRegion = EDITOR_CROP;

  async interact(_driver: WebDriver): Promise<void> {
    // Just open the file — syntax highlighting is always visible.
  }
}
