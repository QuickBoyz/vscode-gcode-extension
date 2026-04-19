import * as path from 'path';

import { ExTester } from 'vscode-extension-tester';

import { SettingsSeeder } from './SettingsSeeder';

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

    const tester = new ExTester(path.join(this.repoRoot, '.vscode-test', 'screenshot-storage'));

    await tester.downloadCode('stable');
    await tester.installVsix();

    return tester.runTests(runnerPattern, {
      resources: [path.join(this.repoRoot, 'src', 'e2e', 'fixtures')],
      settings: settingsPath,
    });
  }
}
