import {
  CodeActionKind,
  createConnection,
  DidChangeTextDocumentNotification,
  InitializeParams,
  InitializeResult,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { DefinitionProvider } from '../providers/DefinitionProvider';
import { DiagnosticsProvider } from '../providers/DiagnosticsProvider';
import { DocumentFormattingProvider } from '../providers/DocumentFormattingProvider';
import { DocumentHighlightProvider } from '../providers/DocumentHighlightProvider';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';
import { DocumentSymbolProvider } from '../providers/DocumentSymbolProvider';
import { FormatterService } from '../providers/FormatterService';
import { ContentChange } from '../parser/IncrementalParsingService';
import { ReferencesProvider } from '../providers/ReferencesProvider';
import { RenameProvider } from '../providers/RenameProvider';
import {
  SEMANTIC_TOKENS_LEGEND,
  SemanticTokensProvider,
} from '../providers/SemanticTokensProvider';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { HoverProvider } from '../providers/HoverProvider';
import { CodeActionProvider } from '../providers/CodeActionProvider';
import { CompletionProvider } from '../providers/CompletionProvider';
import { FoldingRangeProvider } from '../providers/FoldingRangeProvider';
import { GCodeConfig } from '../config/types';
import { ServerConfigProvider } from '../config/server-config-provider/ServerConfigProvider';
import { WorkspaceSymbolIndex } from '../providers/WorkspaceSymbolIndex';
import { WorkspaceSymbolProvider } from '../providers/WorkspaceSymbolProvider';

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const configProvider = new ServerConfigProvider(connection);

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
      definitionProvider: true,
      referencesProvider: true,
      documentHighlightProvider: true,
      documentSymbolProvider: {
        label: 'G-code Variables',
      },
      hoverProvider: true,
      foldingRangeProvider: true,
      // Enable quick-fix code actions
      codeActionProvider: {
        codeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.SourceFixAll],
      },
      // Enable diagnostics for syntax errors
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
      // Enable workspace symbol search (Ctrl+T)
      workspaceSymbolProvider: true,
      // Enable completion with trigger characters
      completionProvider: {
        triggerCharacters: [
          'G',
          'g',
          'M',
          'm',
          'X',
          'x',
          'Y',
          'y',
          'Z',
          'z',
          '#',
          '[',
          ' ',
          'I',
          'i',
          'J',
          'j',
          'K',
          'k',
          'R',
          'r',
          'F',
          'f',
          'S',
          's',
          'T',
          't',
        ],
        resolveProvider: true,
      },
    },
  };
});

// Handle settings changes
connection.onDidChangeConfiguration(() => {
  // Clear cached config and document states when configuration changes
  configProvider.invalidate();
  documentStateManager.clearAll();
  workspaceSymbolIndex.clear();
  connection.console.log('Configuration changed - caches cleared');

  // Re-apply workspace settings after cache invalidation
  void applyWorkspaceSettings();
});

/**
 * Reads workspace-level settings from the config provider
 * and applies them to the workspace symbol index.
 */
async function applyWorkspaceSettings(): Promise<void> {
  const config = await configProvider.getConfig();
  workspaceSymbolIndex.setMaxSymbols(config.workspace.maxSymbols);
}

/**
 * Fetches the scoped {@link GCodeConfig} for a document URI and
 * bridges it to the {@link GCodeSettings} shape expected by
 * existing providers.
 */
async function getDocumentSettings(uri: string): Promise<GCodeSettings> {
  const config = await configProvider.getConfig(uri);
  return toGCodeSettings(config);
}

/**
 * Converts a {@link GCodeConfig} to the {@link GCodeSettings} bridge
 * type consumed by existing providers.
 */
function toGCodeSettings(config: GCodeConfig): GCodeSettings {
  return {
    formatter: config.formatter,
    dialect: config.dialect,
  };
}

const formatterService = new FormatterService(),
  // Create document state manager and providers
  documentStateManager = new DocumentStateManager(),
  documentFormatter = new DocumentFormattingProvider(formatterService, documentStateManager),
  definitionProvider = new DefinitionProvider(documentStateManager),
  referencesProvider = new ReferencesProvider(documentStateManager),
  renameProvider = new RenameProvider(documentStateManager),
  documentHighlightProvider = new DocumentHighlightProvider(documentStateManager),
  documentSymbolProvider = new DocumentSymbolProvider(documentStateManager),
  hoverProvider = new HoverProvider(documentStateManager),
  diagnosticsProvider = new DiagnosticsProvider(documentStateManager),
  codeActionProvider = new CodeActionProvider(),
  completionProvider = new CompletionProvider(documentStateManager),
  workspaceSymbolIndex = new WorkspaceSymbolIndex(),
  workspaceSymbolProvider = new WorkspaceSymbolProvider(workspaceSymbolIndex);

connection.onDocumentFormatting(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const settings = await getDocumentSettings(params.textDocument.uri);
  return documentFormatter.provideDocument(document, settings.formatter, settings.dialect);
});

connection.onDocumentRangeFormatting(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const settings = await getDocumentSettings(params.textDocument.uri);
  return documentFormatter.provideRange(
    document,
    params.range,
    settings.formatter,
    settings.dialect
  );
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

// Register definition provider
connection.onDefinition(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return definitionProvider.provideDefinition(document, params.position, settings);
});

// Register references provider
connection.onReferences(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return referencesProvider.provideReferences(
    document,
    params.position,
    settings,
    params.context.includeDeclaration
  );
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

// Register hover provider
connection.onHover(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return hoverProvider.provideHover(document, params.position, settings);
});

// Register completion provider
connection.onCompletion(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return completionProvider.provideCompletionItems(document, params.position, settings);
});

// Register completion resolve handler (for lazy-loading documentation)
connection.onCompletionResolve((item) => {
  return completionProvider.resolveCompletionItem(item);
});

// Register workspace symbol provider
connection.onWorkspaceSymbol((params) => {
  return workspaceSymbolProvider.provideWorkspaceSymbols(params.query);
});

// Register code action provider
connection.onCodeAction(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) return [];

  const settings = await getDocumentSettings(params.textDocument.uri);
  return codeActionProvider.provideCodeActions(
    document,
    params.range,
    params.context.diagnostics,
    settings,
    params.context
  );
});

// Register folding range provider
connection.onFoldingRanges(async (params) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const settings = await getDocumentSettings(params.textDocument.uri);
  return new FoldingRangeProvider().provideFoldingRanges(document, documentStateManager, settings);
});

// -- Incremental change capture --
// Intercept raw textDocument/didChange to extract content changes
// for incremental parsing before TextDocuments applies them.
const DIAGNOSTICS_DEBOUNCE_MS = 200;
const diagnosticsTimers = new Map<string, ReturnType<typeof setTimeout>>();

connection.onNotification(DidChangeTextDocumentNotification.type, (params) => {
  const uri = params.textDocument.uri;
  for (const change of params.contentChanges) {
    if ('range' in change) {
      const range = change.range;
      const oldEndLine = range.end.line;
      const newLineCount = change.text.split('\n').length - 1;
      const oldLineCount = oldEndLine - range.start.line;
      const lineDelta = newLineCount - oldLineCount;

      const contentChange: ContentChange = {
        startLine: range.start.line,
        startCharacter: range.start.character,
        endLine: range.end.line,
        endCharacter: range.end.character,
        lineDelta,
      };
      documentStateManager.applyContentChange(uri, contentChange);
    } else {
      // Full-document replacement — force full re-parse
      documentStateManager.invalidateDocument(uri);
    }
  }
});

// Publish diagnostics on document change (debounced)
documents.onDidChangeContent((change) => {
  const uri = change.document.uri;

  // Clear any pending debounce timer
  const existing = diagnosticsTimers.get(uri);
  if (existing) clearTimeout(existing);

  diagnosticsTimers.set(
    uri,
    setTimeout(() => {
      diagnosticsTimers.delete(uri);
      void configProvider.getConfig(uri).then((config) => {
        const settings = toGCodeSettings(config);
        const diagnostics = diagnosticsProvider.provideDiagnostics(change.document, settings);
        connection.sendDiagnostics({ uri, diagnostics }).catch((error: Error) => {
          connection.console.error(`Failed to send diagnostics for ${uri}: ${error.message}`);
        });

        // Update workspace symbol index if indexing is enabled
        if (config.workspace.indexingEnabled) {
          workspaceSymbolIndex.indexFile(uri, change.document.getText(), config.dialect);
        }
      });
    }, DIAGNOSTICS_DEBOUNCE_MS)
  );
});

// Also publish diagnostics when document is opened
documents.onDidOpen(async (event) => {
  const config = await configProvider.getConfig(event.document.uri);
  const settings = toGCodeSettings(config);
  const diagnostics = diagnosticsProvider.provideDiagnostics(event.document, settings);
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

  // Index file for workspace symbol search if indexing is enabled
  if (config.workspace.indexingEnabled) {
    workspaceSymbolIndex.indexFile(event.document.uri, event.document.getText(), config.dialect);
  }
});

// Clean up caches and timers when a document is closed
documents.onDidClose((event) => {
  const uri = event.document.uri;
  const timer = diagnosticsTimers.get(uri);
  if (timer) {
    clearTimeout(timer);
    diagnosticsTimers.delete(uri);
  }
  documentStateManager.removeDocument(uri);
  // Note: We intentionally keep workspace symbols indexed after close,
  // so workspace symbol search still finds symbols from previously opened files.
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
