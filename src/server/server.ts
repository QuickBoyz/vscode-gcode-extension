import {
  createConnection,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DiagnosticsProvider } from '../providers/DiagnosticsProvider';
import { DocumentFormattingProvider } from '../providers/DocumentFormattingProvider';
import { DocumentHighlightProvider } from '../providers/DocumentHighlightProvider';
import { DocumentRangeFormattingProvider } from '../providers/DocumentRangeFormattingProvider';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';
import { DocumentSymbolProvider } from '../providers/DocumentSymbolProvider';
import { FormatterService } from '../providers/FormatterService';
import { RenameProvider } from '../providers/RenameProvider';
import {
  SEMANTIC_TOKENS_LEGEND,
  SemanticTokensProvider,
} from '../providers/SemanticTokensProvider';

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all),
  // Create a text document manager
  documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument),
  // Note: GCodeSettings is now imported from DocumentStateManager

  // Cache document settings
  documentSettings: Map<string, Thenable<GCodeSettings>> = new Map();

// Server settings synced from the client
connection.onInitialize((_params: InitializeParams): InitializeResult => {
  connection.console.log('G-code Language Server initializing...');

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
        label: 'G-code Variables',
      },
      // Enable diagnostics for syntax errors
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
  };
});

function getDocumentSettings(uri: string): Thenable<GCodeSettings> {
  let settings = documentSettings.get(uri);
  if (!settings) {
    settings = connection.workspace.getConfiguration({
      scopeUri: uri,
      section: 'gcode',
    });
    documentSettings.set(uri, settings);
  }
  return settings;
}

const formatterService = new FormatterService(),
  documentFormatter = new DocumentFormattingProvider(formatterService),
  rangeFormatter = new DocumentRangeFormattingProvider(formatterService),
  // Create document state manager and providers
  documentStateManager = new DocumentStateManager(),
  renameProvider = new RenameProvider(documentStateManager),
  documentHighlightProvider = new DocumentHighlightProvider(documentStateManager),
  documentSymbolProvider = new DocumentSymbolProvider(documentStateManager),
  diagnosticsProvider = new DiagnosticsProvider(documentStateManager);

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
  return rangeFormatter.provide(document, params.range, settings.formatter);
});

connection.languages.semanticTokens.on(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return { data: [] };
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return SemanticTokensProvider.provide(document, documentStateManager, settings);
});

// Register rename provider
connection.onPrepareRename(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return renameProvider.prepareRename(document, params.position, settings);
});

connection.onRenameRequest(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return renameProvider.provideRenameEdits(document, params.position, params.newName, settings);
});

// Register document highlight provider
connection.onDocumentHighlight(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return documentHighlightProvider.provideDocumentHighlights(document, params.position, settings);
});

// Register document symbol provider
connection.onDocumentSymbol(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return documentSymbolProvider.provideDocumentSymbols(document, settings);
});

// Publish diagnostics on document change
documents.onDidChangeContent(async (change) => {
  documentStateManager.invalidateDocument(change.document.uri);

  // Publish diagnostics for syntax errors
  const settings = await getDocumentSettings(change.document.uri),
    diagnostics = diagnosticsProvider.provideDiagnostics(change.document, settings);
  connection
    .sendDiagnostics({
      uri: change.document.uri,
      diagnostics,
    })
    .catch((error: Error) => {
      connection.console.error(
        `Failed to send diagnostics for ${change.document.uri}: ${error.message}`
      );
    });
});

// Also publish diagnostics when document is opened
documents.onDidOpen(async (event) => {
  const settings = await getDocumentSettings(event.document.uri),
    diagnostics = diagnosticsProvider.provideDiagnostics(event.document, settings);
  connection
    .sendDiagnostics({
      uri: event.document.uri,
      diagnostics,
    })
    .catch((error: Error) => {
      connection.console.error(
        `Failed to send diagnostics for ${event.document.uri}: ${error.message}`
      );
    });
});

// Register pull-based diagnostics handler (for newer VS Code versions)
connection.languages.diagnostics.on(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return {
      kind: 'full',
      items: [],
    };
  }

  const settings = await getDocumentSettings(params.textDocument.uri),
    diagnostics = diagnosticsProvider.provideDiagnostics(document, settings);

  return {
    kind: 'full',
    items: diagnostics,
  };
});

connection.onInitialized(() => {
  connection.console.log('G-code Language Server initialized');
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
