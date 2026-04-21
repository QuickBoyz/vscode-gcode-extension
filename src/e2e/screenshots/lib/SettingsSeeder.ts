import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const SEED_SETTINGS = {
  'workbench.colorTheme': 'G-Code Theme',
  'workbench.startupEditor': 'none',
  'workbench.tips.enabled': false,
  'workbench.welcomePage.walkthroughs.openOnInstall': false,
  'workbench.statusBar.visible': true,
  'workbench.activityBar.location': 'default',
  'extensions.ignoreRecommendations': true,
  'extensions.autoCheckUpdates': false,
  'extensions.autoUpdate': false,
  'update.mode': 'none',
  'update.showReleaseNotes': false,
  'telemetry.telemetryLevel': 'off',
  'git.enabled': false,
  'git.autofetch': false,
  'git.openRepositoryInParentFolders': 'never',
  'scm.autoReveal': false,
  'security.workspace.trust.enabled': false,
  'security.workspace.trust.banner': 'never',
  'security.workspace.trust.startupPrompt': 'never',
  'notifications.showExtensionsWithUpdatesAvailable': false,
  'gcode.dialect': 'linuxcnc',
};

/** Writes a pre-seeded VS Code settings.json for the screenshot pipeline. */
export class SettingsSeeder {
  /** Writes settings to a temp file and returns its path (for RunOptions.settings). */
  static createTempFile(): string {
    const filePath = path.join(os.tmpdir(), `gcode-screenshot-settings-${Date.now()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(SEED_SETTINGS, null, 2), 'utf-8');
    return filePath;
  }
}
