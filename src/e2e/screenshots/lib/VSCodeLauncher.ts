import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ExTester } from 'vscode-extension-tester';

import { SettingsSeeder } from './SettingsSeeder';

/**
 * Pinned to a stable VS Code version. ExTester 8.x resolves ChromeDriver via
 * the Chrome-for-Testing endpoint, so we are no longer constrained to the
 * Chromium-114 era. This version's bundled Electron exposes the CDP
 * `Browser.getWindowForTarget` command, which is what makes `setRect()` and
 * `maximize()` work (both are needed to coerce the window to 1920x1080 on CI).
 */
const PINNED_VSCODE_VERSION = '1.95.3';

/** Wraps ExTester setup for the screenshot pipeline. */
export class VSCodeLauncher {
  private readonly repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  /**
   * Downloads VS Code + ChromeDriver, installs the extension, and runs the given
   * Mocha test file pattern. Returns the Mocha exit code (0 = success).
   */
  async launch(runnerPattern: string): Promise<number> {
    const settingsPath = SettingsSeeder.createTempFile();

    // Isolate the test instance's extensions dir so user-installed extensions
    // (e.g. vscode-icons, which injects a welcome toast) do not leak into the
    // screenshots. Without this, ExTester picks up ~/.vscode/extensions.
    const storageDir = path.join(this.repoRoot, '.vscode-test', 'screenshot-storage');
    const extensionsDir = path.join(this.repoRoot, '.vscode-test', 'screenshot-extensions');
    const tester = new ExTester(storageDir, undefined, extensionsDir);
    const vsixFile = path.join(this.repoRoot, '.vscode-test', 'screenshot-extension.vsix');

    // Write the fixtures path to a well-known temp file so that the
    // `gcode.e2eAddWorkspaceFolder` command can add it to the workspace
    // from within the hero scene without reloading VS Code.
    const fixturesDir = path.join(this.repoRoot, 'src', 'e2e', 'fixtures');
    fs.writeFileSync(path.join(os.tmpdir(), '.gcode-screenshot-fixtures'), fixturesDir, 'utf8');

    await tester.downloadCode(PINNED_VSCODE_VERSION);
    await tester.downloadChromeDriver(PINNED_VSCODE_VERSION);
    await tester.installVsix({ vsixFile });

    return tester.runTests(runnerPattern, {
      vscodeVersion: PINNED_VSCODE_VERSION,
      resources: [fixturesDir],
      settings: settingsPath,
      config: path.join(this.repoRoot, 'src', 'e2e', 'screenshots', '.mocharc.js'),
    });
  }
}
