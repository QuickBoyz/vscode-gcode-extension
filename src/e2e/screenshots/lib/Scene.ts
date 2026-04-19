import * as fs from 'fs';
import * as path from 'path';

import { WebDriver } from 'selenium-webdriver';

import { Capture } from './Capture';

/** Region (pixels) to crop from a full-window screenshot. */
export interface CropRegion {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Abstract base class for all screenshot scenes. */
export abstract class Scene {
  /** Stable output path relative to the repo root, e.g. `images/screenshots/01-syntax.png`. */
  abstract readonly outputPath: string;

  /**
   * Fixture file path relative to `src/e2e/`, e.g. `fixtures/complex.nc`
   * or `fixtures/screenshots/basic-3d.nc`.
   */
  abstract readonly fixture: string;

  /**
   * Region to crop from the full-window screenshot.
   * Null means full window (no crop) — used for the hero scene.
   */
  readonly cropRegion: CropRegion | null = null;

  constructor(protected readonly repoRoot: string) {}

  /** Absolute path to this scene's fixture file. */
  fixtureAbsPath(): string {
    return path.join(this.repoRoot, 'src', 'e2e', this.fixture);
  }

  /**
   * Extension-specific interactions to perform after the document is open
   * and the language server is ready. Override in each scene subclass.
   *
   * Default implementation does nothing (sufficient for syntax scene).
   */
  async interact(_driver: WebDriver): Promise<void> {}

  /**
   * Capture and write the screenshot for this scene.
   * Called by SceneRunner after interact() completes.
   */
  async capture(driver: WebDriver): Promise<void> {
    const rawPng = await driver.takeScreenshot();
    const rawBuffer = Buffer.from(rawPng, 'base64');

    const absOutput = path.resolve(this.repoRoot, this.outputPath);
    fs.mkdirSync(path.dirname(absOutput), { recursive: true });

    if (this.cropRegion === null) {
      fs.writeFileSync(absOutput, rawBuffer);
    } else {
      await Capture.cropAndWrite(rawBuffer, this.cropRegion, absOutput);
    }
  }
}
