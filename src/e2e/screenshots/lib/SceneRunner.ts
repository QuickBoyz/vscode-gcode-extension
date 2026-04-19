import { WebDriver } from 'selenium-webdriver';

import { CommandPaletteRunner } from './CommandPaletteRunner';
import { Scene } from './Scene';

const SETTLE_DELAY_MS = 2000;

export interface SceneResult {
  readonly sceneName: string;
  readonly success: boolean;
  readonly error?: unknown;
}

/** Iterates scenes sequentially; per-scene errors are caught so remaining scenes still run. */
export class SceneRunner {
  private readonly scenes: readonly Scene[];

  constructor(scenes: readonly Scene[]) {
    this.scenes = scenes;
  }

  /**
   * Runs all scenes in order. Returns 0 if all succeeded, 1 if any failed.
   * Failures are logged but do not abort the remaining scenes.
   */
  async run(driver: WebDriver): Promise<number> {
    const results: SceneResult[] = [];

    for (const scene of this.scenes) {
      const name = scene.constructor.name;
      try {
        console.info(`[screenshot] Running scene: ${name} → ${scene.outputPath}`);
        await this.prepareForScene(driver, scene);
        await scene.interact(driver);
        await scene.capture(driver);
        results.push({ sceneName: name, success: true });
        console.info(`[screenshot] ✓ ${name}`);
      } catch (error) {
        results.push({ sceneName: name, success: false, error });
        console.error(`[screenshot] ✗ ${name}:`, error);
      }
    }

    const failed = results.filter((r) => !r.success).length;
    console.info(`[screenshot] Done: ${results.length - failed}/${results.length} scenes captured`);
    return failed > 0 ? 1 : 0;
  }

  private async prepareForScene(driver: WebDriver, scene: Scene): Promise<void> {
    // Open the fixture via Quick Open. `code -r <path>` (VSBrowser.openResources)
    // fails silently against VS Code instances launched by ChromeDriver.
    // We use raw keyboard input (see CommandPaletteRunner) instead of the
    // monaco-page-objects helper because the latter's webview-detection path
    // wedges after the visualizer scenes. We intentionally do NOT close
    // previous editors: `closeAllEditors` triggers "unsaved changes" modals
    // whenever a prior scene mutated the buffer (e.g. FormatScene), and those
    // modals cannot be reliably dismissed via selenium. Quick Open brings the
    // freshly-opened fixture to the foreground; stale tabs are harmless.
    await CommandPaletteRunner.openFile(driver, scene.fixtureAbsPath());

    // Allow the language server and document to settle.
    await driver.sleep(SETTLE_DELAY_MS);
  }
}
