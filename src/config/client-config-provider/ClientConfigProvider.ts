/**
 * Client-side configuration provider.
 *
 * Reads extension settings from the VS Code workspace configuration
 * API and supports writing partial updates back to user settings.
 */

import * as vscode from 'vscode';

import { GCODE_LANGUAGE_ID } from '../../constants';
import { ConfigProvider } from '../ConfigProvider';
import { DeepPartial, GCodeConfig } from '../types';

/**
 * Configuration provider for the VS Code extension client.
 *
 * Uses `vscode.workspace.getConfiguration` to read settings and
 * `WorkspaceConfiguration.update` to write them. Results are cached
 * by the base {@link ConfigProvider}.
 */
export class ClientConfigProvider extends ConfigProvider {
  /**
   * Clears the configuration cache so the next {@link getConfig}
   * call re-reads from VS Code.
   */
  override invalidate(): void {
    super.invalidate();
  }

  /**
   * Writes a partial configuration update to user-level settings
   * and invalidates the cache.
   */
  async updateConfig(partial: DeepPartial<GCodeConfig>): Promise<void> {
    const config = vscode.workspace.getConfiguration(GCODE_LANGUAGE_ID);

    const flatEntries = flattenConfig(partial);
    for (const [key, value] of flatEntries) {
      await config.update(key, value, true);
    }

    this.invalidate();
  }

  protected fetchRawConfig(): Promise<Record<string, unknown>> {
    const config = vscode.workspace.getConfiguration(GCODE_LANGUAGE_ID);

    const raw: Record<string, unknown> = {
      dialect: config.get<string>('dialect'),
      formatter: {
        addLineNumbers: config.get<boolean>('formatter.addLineNumbers'),
        lineNumberStart: config.get<number>('formatter.lineNumberStart'),
        lineNumberIncrement: config.get<number>('formatter.lineNumberIncrement'),
        prettyPrintCommands: config.get<boolean>('formatter.prettyPrintCommands'),
        prettyPrintNumbers: config.get<boolean>('formatter.prettyPrintNumbers'),
        indentSize: config.get<number>('formatter.indentSize'),
        useTabs: config.get<boolean>('formatter.useTabs'),
        indent: config.get<boolean>('formatter.indent'),
        compactOutput: config.get<boolean>('formatter.compactOutput'),
        addProgramDelimiters: config.get<boolean>('formatter.addProgramDelimiters'),
      },
      visualizer: {
        rapidColor: config.get<string>('visualizer.rapidColor'),
        feedColor: config.get<string>('visualizer.feedColor'),
        arcColor: config.get<string>('visualizer.arcColor'),
        lineThickness: config.get<number>('visualizer.lineThickness'),
        showGrid: config.get<boolean>('visualizer.showGrid'),
        gridSpacing: config.get<number>('visualizer.gridSpacing'),
        showRapidMoves: config.get<boolean>('visualizer.showRapidMoves'),
        projection: config.get<string>('visualizer.projection'),
        playback: {
          rapidSpeed: config.get<number>('visualizer.playback.rapidSpeed'),
          defaultFeedRate: config.get<number>('visualizer.playback.defaultFeedRate'),
          followSourceLine: config.get<boolean>('visualizer.playback.followSourceLine'),
        },
      },
      extractor: {
        machineHome: config.get<Record<string, number>>('extractor.machineHome'),
      },
      interpreter: {
        maxIterations: config.get<number>('interpreter.maxIterations'),
      },
      variables: config.get<Record<string, number>>('variables') ?? {},
    };

    return Promise.resolve(raw);
  }
}

/**
 * Flattens a nested partial config object into dot-separated key-value
 * pairs suitable for `WorkspaceConfiguration.update()`.
 *
 * Example: `{ visualizer: { rapidColor: '#ff0000' } }` becomes
 * `[['visualizer.rapidColor', '#ff0000']]`.
 */
function flattenConfig(obj: Record<string, unknown>, prefix = ''): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      entries.push(...flattenConfig(value as Record<string, unknown>, fullKey));
    } else {
      entries.push([fullKey, value]);
    }
  }

  return entries;
}
