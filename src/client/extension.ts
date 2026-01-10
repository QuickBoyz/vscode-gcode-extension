/**
 * G-code Language Client
 *
 * This is the VS Code extension entry point that starts the Language Server
 * and manages communication with it.
 */
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

const GCODE_LANGUAGE_ID = 'gcode';
// Reads G-code file extensions from package.json contributes.languages configuration

let client: LanguageClient;

/**
 * This method is called when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.info('G-code extension is now active');

  // Path to the server module
  const serverModule = context.asAbsolutePath(path.join('dist', 'server', 'index.js')),
    // Server options - run the server as a separate Node.js process
    serverOptions: ServerOptions = {
      run: {
        module: serverModule,
        transport: TransportKind.ipc,
      },
      debug: {
        module: serverModule,
        transport: TransportKind.ipc,
        options: {
          execArgv: ['--nolazy', '--inspect=6009'],
        },
      },
    },
    // Client options
    clientOptions: LanguageClientOptions = {
      // Register the server for G-code documents
      documentSelector: [{ scheme: 'file', language: GCODE_LANGUAGE_ID }],
      synchronize: {
        // Notify the server about file changes to G-code files
        // Sync configuration section
        configurationSection: GCODE_LANGUAGE_ID,
      },
    };

  // Create the language client and start it
  client = new LanguageClient(
    'gcodeLanguageServer',
    'G-code Language Server',
    serverOptions,
    clientOptions
  );

  // Start the client (which also launches the server)
  await client.start();
  context.subscriptions.push(client);
}

/**
 * This method is called when the extension is deactivated
 */
export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
  }
}
