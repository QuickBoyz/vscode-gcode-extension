/**
 * G-code Language Server
 *
 * Provides language features for G-code files using the Language Server Protocol (LSP).
 * Currently supports:
 * - Document formatting
 * - Range formatting
 * - Variable hover information
 * - G/M code hover descriptions
 * - Variable definition navigation
 * - Variable rename (F2 or context menu)
 * - Variable completion (Ctrl+Space)
 * - Semantic highlighting
 */
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  createConnection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from "vscode-languageserver/node";
import { FormatterService } from "../_providers/FormatterService";
import { DocumentRangeFormattingProvider } from "../_providers/DocumentRangeFormattingProvider";
import { DocumentFormattingProvider } from "../_providers/DocumentFormattingProvider";
import { FormatterSettings } from "../formatter";
import {
  SEMANTIC_TOKENS_LEGEND,
  SemanticTokensProvider,
} from "../_providers/SemanticTokensProvider";

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all);
// Create a text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(
  TextDocument
);

// Server settings synced from the client
interface GCodeSettings {
  formatter: FormatterSettings;
}

// Cache document settings
const documentSettings: Map<
  string,
  Thenable<GCodeSettings>
> = new Map();

// Server settings synced from the client
connection.onInitialize(
  (_params: InitializeParams): InitializeResult => {
    connection.console.log("G-code Language Server initializing...");

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        documentFormattingProvider: true,
        documentRangeFormattingProvider: true,
        semanticTokensProvider: {
          legend: SEMANTIC_TOKENS_LEGEND,
          full: true,
        },
      },
    };
  }
);

function getDocumentSettings(uri: string): Thenable<GCodeSettings> {
  let settings = documentSettings.get(uri);
  if (!settings) {
    settings = connection.workspace.getConfiguration({
      scopeUri: uri,
      section: "gcode",
    });
    documentSettings.set(uri, settings);
  }
  return settings;
}

const formatterService = new FormatterService();
const documentFormatter = new DocumentFormattingProvider(
  formatterService
);
const rangeFormatter = new DocumentRangeFormattingProvider(
  formatterService
);

connection.onDocumentFormatting(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const settings = await getDocumentSettings(params.textDocument.uri);
  return documentFormatter.provide(document, settings.formatter);
});

connection.onDocumentRangeFormatting(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const settings = await getDocumentSettings(params.textDocument.uri);
  return rangeFormatter.provide(
    document,
    params.range,
    settings.formatter
  );
});

connection.languages.semanticTokens.on((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return { data: [] };
  }

  return SemanticTokensProvider.provide(document);
});

connection.onInitialized(() => {
  connection.console.log("G-code Language Server initialized");
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
