/**
 * Server-side configuration provider.
 *
 * Fetches extension settings via the LSP {@link Connection} object
 * using `workspace/configuration` requests. The server side is
 * read-only -- {@link updateConfig} always throws.
 */

import { Connection } from 'vscode-languageserver/node';

import { GCODE_LANGUAGE_ID } from '../../constants';
import { ConfigProvider } from '../ConfigProvider';
import { DeepPartial, GCodeConfig } from '../types';

/**
 * Configuration provider for the language server process.
 *
 * Uses the LSP connection to request scoped configuration from the
 * client. Results are cached by the base {@link ConfigProvider}.
 */
export class ServerConfigProvider extends ConfigProvider {
  private readonly connection: Connection;

  constructor(connection: Connection) {
    super();
    this.connection = connection;
  }

  /**
   * Clears the configuration cache so the next {@link getConfig}
   * call re-fetches from the client.
   */
  override invalidate(): void {
    super.invalidate();
  }

  /**
   * The server side is read-only; writing configuration is not supported.
   *
   * @throws {Error} Always throws -- use {@link ClientConfigProvider} to write.
   */
  updateConfig(_partial: DeepPartial<GCodeConfig>): Promise<void> {
    return Promise.reject(new Error('ServerConfigProvider does not support writing configuration'));
  }

  protected async fetchRawConfig(uri?: string): Promise<Record<string, unknown>> {
    const raw: unknown = await this.connection.workspace.getConfiguration({
      scopeUri: uri,
      section: GCODE_LANGUAGE_ID,
    });
    return (raw ?? {}) as Record<string, unknown>;
  }
}
