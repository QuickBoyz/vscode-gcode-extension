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
import { WorkDoneProgress } from 'vscode-languageserver-protocol';

import { ClientConfigProvider } from '../config/client-config-provider/ClientConfigProvider';
import { CommandProvider } from './CommandProvider';
import { WorkspaceFileEnumerator } from './WorkspaceFileEnumerator';
import { GCODE_LANGUAGE_ID } from '../constants';
import {
  GCODE_LIST_INDEX_FILES_CAPABILITY_VERSION,
  GCodeListIndexFilesRequest,
} from '../lsp/gcodeListIndexFiles';

// Reads G-code file extensions from package.json contributes.languages configuration

let client: LanguageClient;
let commandProvider: CommandProvider;

/**
 * This method is called when the extension is activated
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.info('G-code extension is now active');

  // Path to the server module
  const serverModule = context.asAbsolutePath(path.join('dist', 'server', 'index.js'));

  // Server options - run the server as a separate Node.js process
  const serverOptions: ServerOptions = {
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
  };

  // Client options
  const clientOptions: LanguageClientOptions = {
    // Register the server for G-code documents
    documentSelector: [{ scheme: 'file', language: GCODE_LANGUAGE_ID }],
    synchronize: {
      // Notify the server about file changes to G-code files
      // Sync configuration section
      configurationSection: GCODE_LANGUAGE_ID,
    },
    initializationOptions: {
      experimental: {
        gcode: {
          listIndexFiles: { version: GCODE_LIST_INDEX_FILES_CAPABILITY_VERSION },
        },
      },
    },
  };

  // Create the language client
  client = new LanguageClient(
    'gcodeLanguageServer',
    'G-code Language Server',
    serverOptions,
    clientOptions
  );

  // Register the workspace enumeration request handler BEFORE starting the
  // client so the handler is guaranteed to be active by the time the server
  // sends its first `workspace/gcodeListIndexFiles` request. vscode-languageclient
  // queues request handlers attached before `start()` and wires them into the
  // connection during the LSP handshake — relying on post-`start()` registration
  // would make correctness depend on event-loop scheduling between the
  // resolved `start()` promise and the server's `onInitialized` chain.
  const enumerator = new WorkspaceFileEnumerator({
    findFiles: (include, exclude) => vscode.workspace.findFiles(include, exclude ?? null),
    getExcludes: () => {
      const config = vscode.workspace.getConfiguration();
      return {
        filesExclude: config.get<Record<string, unknown>>('files.exclude') ?? {},
        searchExclude: config.get<Record<string, unknown>>('search.exclude') ?? {},
      };
    },
    reportProgress: (token, value) => {
      void client.sendProgress(WorkDoneProgress.type, token, value);
    },
  });
  context.subscriptions.push(
    client.onRequest(GCodeListIndexFilesRequest, (params) => enumerator.handle(params))
  );

  // Start the client (which also launches the server)
  await client.start();
  context.subscriptions.push(client);

  // Register all commands
  const configProvider = new ClientConfigProvider();
  commandProvider = new CommandProvider(configProvider);
  commandProvider.registerCommands(context);
}

/**
 * This method is called when the extension is deactivated
 */
export async function deactivate(): Promise<void> {
  if (commandProvider) {
    commandProvider.dispose();
  }
  if (client) {
    await client.stop();
  }
}
