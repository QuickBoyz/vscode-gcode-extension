/**
 * G-code Language Client
 *
 * This is the VS Code extension entry point that starts the Language Server
 * and manages communication with it.
 */
import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

const GCODE_LANGUAGE_ID = "gcode";
const GCODE_FILE_EXTENSIONS = [
  ".001",
  ".apt",
  ".aptcl",
  ".cls",
  ".cnc",
  ".din",
  ".dnc",
  ".ecs",
  ".eia",
  ".fan",
  ".fgc",
  ".fnc",
  ".g",
  ".g00",
  ".gc",
  ".gcd",
  ".gcode",
  ".gp",
  ".hnc",
  ".knc",
  ".lib",
  ".m",
  ".min",
  ".mpf",
  ".mpr",
  ".msb",
  ".nc",
  ".ncc",
  ".ncd",
  ".ncf",
  ".ncg",
  ".nci",
  ".ncp",
  ".ngc",
  ".out",
  ".pim",
  ".pit",
  ".plt",
  ".ply",
  ".prg",
  ".pu1",
  ".rol",
  ".S",
  ".sbp",
  ".spf",
  ".ssb",
  ".sub",
  ".tap",
  ".xpi",
];

let client: LanguageClient;

/**
 * This method is called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log("G-code extension is now active");

  // Path to the server module
  const serverModule = context.asAbsolutePath(
    path.join("dist", "server", "index.js")
  );

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
        execArgv: ["--nolazy", "--inspect=6009"],
      },
    },
  };

  // Client options
  const clientOptions: LanguageClientOptions = {
    // Register the server for G-code documents
    documentSelector: [{ scheme: "file", language: GCODE_LANGUAGE_ID }],
    synchronize: {
      // Notify the server about file changes to G-code files
      fileEvents: vscode.workspace.createFileSystemWatcher(
        `**/*.{${GCODE_FILE_EXTENSIONS.join(",")}}`
      ),
      // Sync configuration section
      configurationSection: "gcode",
    },
  };

  // Create the language client and start it
  client = new LanguageClient(
    "gcodeLanguageServer",
    "G-code Language Server",
    serverOptions,
    clientOptions
  );

  // Start the client (which also launches the server)
  client.start();

  // Register format document command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "gcode.formatDocument",
      async () => {
        const editor = vscode.window.activeTextEditor;
        if (
          editor &&
          editor.document.languageId === GCODE_LANGUAGE_ID
        ) {
          await vscode.commands.executeCommand(
            "editor.action.formatDocument"
          );
        } else {
          vscode.window.showWarningMessage(
            "Please open a G-code file to format"
          );
        }
      }
    )
  );
}

/**
 * This method is called when the extension is deactivated
 */
export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
  }
}
