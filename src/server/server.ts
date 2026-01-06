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
  TextEdit,
  WorkspaceEdit,
  CompletionParams,
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  createConnection,
  DefinitionLink,
  DefinitionParams,
  DocumentFormattingParams,
  DocumentRangeFormattingParams,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  Location,
  ProposedFeatures,
  Range,
  ReferenceParams,
  RenameParams,
  SemanticTokens,
  SemanticTokensParams,
  TextDocuments,
  TextDocumentSyncKind,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import { FormatterService } from "../_providers/FormatterService";
import { DocumentRangeFormattingProvider } from "../_providers/DocumentRangeFormattingProvider";
import { DocumentFormattingProvider } from "../_providers/DocumentFormattingProvider";
import {
  SEMANTIC_TOKENS_LEGEND,
  SemanticTokensProvider,
} from "../_providers/SemanticTokensProvider";
import { DocumentStateManager, GCodeSettings } from "../_providers/DocumentStateManager";
import { RenameProvider } from "../_providers/RenameProvider";
import { DocumentHighlightProvider } from "../_providers/DocumentHighlightProvider";
import { DocumentSymbolProvider } from "../_providers/DocumentSymbolProvider";

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all);
// Create a text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(
  TextDocument
);

// Note: GCodeSettings is now imported from DocumentStateManager

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
        renameProvider: {
          prepareProvider: true,
        },
        documentHighlightProvider: true,
        documentSymbolProvider: {
          label: "G-code Variables",
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

// Create document state manager and providers
const documentStateManager = new DocumentStateManager();
const renameProvider = new RenameProvider(documentStateManager);
const documentHighlightProvider = new DocumentHighlightProvider(
  documentStateManager
);
const documentSymbolProvider = new DocumentSymbolProvider(documentStateManager);

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

// Register rename provider
connection.onPrepareRename((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  return renameProvider.prepareRename(document, params.position);
});

connection.onRenameRequest((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  return renameProvider.provideRenameEdits(
    document,
    params.position,
    params.newName
  );
});

// Register document highlight provider
connection.onDocumentHighlight((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  return documentHighlightProvider.provideDocumentHighlights(
    document,
    params.position
  );
});

// Register document symbol provider
connection.onDocumentSymbol((params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  return documentSymbolProvider.provideDocumentSymbols(document);
});

// Invalidate document state on change
documents.onDidChangeContent((change) => {
  documentStateManager.invalidateDocument(change.document.uri);
});

connection.onInitialized(() => {
  connection.console.log("G-code Language Server initialized");
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
