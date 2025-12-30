/**
 * G-code Language Server
 *
 * Provides language features for G-code files using the Language Server Protocol (LSP).
 * Currently supports:
 * - Document formatting
 * - Range formatting
 */
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  TextEdit,
  Range,
  Position,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { gcodeParser } from "../parser";
import { defaultFormatterOptions, gcodeFormatter } from "../formatter";
import { FormatterOptions } from "../formatter/types";

// Create a connection for the server using Node's IPC as transport
const connection = createConnection(ProposedFeatures.all);

// Create a text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(
  TextDocument
);

// Server settings synced from the client
interface GCodeSettings {
  formatter: {
    addLineNumbers: boolean;
    lineNumberStart: number;
    lineNumberIncrement: number;
    prettyPrintCommands: boolean;
    prettyPrintNumbers: boolean;
    indent: boolean;
    compactOutput: boolean;
  };
}

const defaultSettings: GCodeSettings = {
  formatter: {
    addLineNumbers: defaultFormatterOptions.addLineNumbers,
    lineNumberStart: defaultFormatterOptions.lineNumberStart,
    lineNumberIncrement: defaultFormatterOptions.lineNumberIncrement,
    prettyPrintCommands: defaultFormatterOptions.prettyPrintCommands,
    prettyPrintNumbers: defaultFormatterOptions.prettyPrintNumbers,
    indent: defaultFormatterOptions.indent,
    compactOutput: defaultFormatterOptions.compactOutput,
  },
};

// Cache document settings
const documentSettings: Map<
  string,
  Thenable<GCodeSettings>
> = new Map();

// Global settings (used when document-specific settings are not available)
let globalSettings: GCodeSettings = defaultSettings;

connection.onInitialize(
  (_params: InitializeParams): InitializeResult => {
    connection.console.log("G-code Language Server initializing...");

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        documentFormattingProvider: true,
        documentRangeFormattingProvider: true,
      },
    };
  }
);

connection.onInitialized(() => {
  connection.console.log("G-code Language Server initialized");
});

// Handle configuration changes
connection.onDidChangeConfiguration((change) => {
  // Clear cached settings
  documentSettings.clear();

  // Update global settings
  if (change.settings?.gcode) {
    globalSettings = {
      formatter: {
        ...defaultSettings.formatter,
        ...change.settings.gcode.formatter,
      },
    };
  }

  connection.console.log("Configuration updated");
});

// Get settings for a specific document
function getDocumentSettings(
  resource: string
): Thenable<GCodeSettings> {
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace
      .getConfiguration({
        scopeUri: resource,
        section: "gcode",
      })
      .then((config) => {
        if (!config) {
          return globalSettings;
        }
        return {
          formatter: {
            ...defaultSettings.formatter,
            ...config.formatter,
          },
        };
      });
    documentSettings.set(resource, result);
  }
  return result;
}

// Clear settings when document is closed
documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

/**
 * Format the entire document
 */
connection.onDocumentFormatting(
  async (
    params: DocumentFormattingParams
  ): Promise<TextEdit[] | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    return formatDocument(
      document,
      params.options.tabSize,
      params.options.insertSpaces
    );
  }
);

/**
 * Format a range in the document
 * Note: G-code formatting requires full document context (especially for line numbers),
 * so we format the entire document even for range requests
 */
connection.onDocumentRangeFormatting(
  async (
    params: DocumentRangeFormattingParams
  ): Promise<TextEdit[] | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    // Format entire document for correctness (line numbers, indentation context)
    return formatDocument(
      document,
      params.options.tabSize,
      params.options.insertSpaces
    );
  }
);

/**
 * Format a document and return TextEdits
 */
async function formatDocument(
  document: TextDocument,
  tabSize: number,
  insertSpaces: boolean
): Promise<TextEdit[] | null> {
  const text = document.getText();

  // Skip empty documents
  if (!text.trim()) {
    return null;
  }

  try {
    // Get document-specific settings
    const settings = await getDocumentSettings(document.uri);

    // Create formatter options from settings
    const formatterOptions: FormatterOptions = {
      addLineNumbers: settings.formatter.addLineNumbers,
      lineNumberStart: settings.formatter.lineNumberStart,
      lineNumberIncrement: settings.formatter.lineNumberIncrement,
      prettyPrintCommands: settings.formatter.prettyPrintCommands,
      prettyPrintNumbers: settings.formatter.prettyPrintNumbers,
      indent: settings.formatter.indent,
      compactOutput: settings.formatter.compactOutput,
      indentSize: tabSize,
      useTabs: !insertSpaces,
    };

    // Parse and format
    const ast = gcodeParser.parseGcode(text);
    gcodeFormatter.setOptions(formatterOptions);
    const formattedText = gcodeFormatter.format(ast);

    // Return a single edit replacing the entire document
    const fullRange: Range = {
      start: Position.create(0, 0),
      end: Position.create(document.lineCount, 0),
    };

    return [TextEdit.replace(fullRange, formattedText)];
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown formatting error";
    connection.console.error(`G-code formatting failed: ${message}`);
    // Show error to user via the client
    connection.window.showErrorMessage(
      `G-code formatting failed: ${message}`
    );
    return null;
  }
}

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
