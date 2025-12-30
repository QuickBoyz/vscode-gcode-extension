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
  CompletionParams,
  CompletionItem,
  CompletionItemKind,
  SemanticTokensParams,
  SemanticTokens,
} from "vscode-languageserver/node";
import {
  DEFAULT_FORMATTER_SETTINGS,
  GCODE_SYMBOLS,
} from "../constants";
import { gcodeFormatter } from "../formatter";
import { FormatterSettings } from "../formatter/types";
import { gcodeParser } from "../parser";
import { HoverProvider } from "./hoverProvider";
import {
  SEMANTIC_TOKENS_LEGEND,
  SemanticTokensProvider,
} from "./semanticTokensProvider";
import { VariableTracker } from "./variableTracker";

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

const defaultSettings: GCodeSettings = {
  formatter: DEFAULT_FORMATTER_SETTINGS,
};

// Cache document settings
const documentSettings: Map<
  string,
  Thenable<GCodeSettings>
> = new Map();

// Global settings (used when document-specific settings are not available)
let globalSettings: GCodeSettings = defaultSettings;

// Variable tracker instance
const variableTracker = new VariableTracker();

// Semantic tokens provider instance
const semanticTokensProvider = new SemanticTokensProvider(
  variableTracker
);

// Hover provider instance
const hoverProvider = new HoverProvider(variableTracker);

connection.onInitialize(
  (_params: InitializeParams): InitializeResult => {
    connection.console.log("G-code Language Server initializing...");

    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        documentFormattingProvider: true,
        documentRangeFormattingProvider: true,
        hoverProvider: true,
        definitionProvider: true,
        referencesProvider: true,
        renameProvider: true,
        completionProvider: {
          triggerCharacters: [GCODE_SYMBOLS.VARIABLE_PREFIX],
        },
        semanticTokensProvider: {
          legend: SEMANTIC_TOKENS_LEGEND,
          full: true,
        },
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
    const formatterOptions: FormatterSettings = {
      addLineNumbers: settings.formatter.addLineNumbers,
      lineNumberStart: settings.formatter.lineNumberStart,
      lineNumberIncrement: settings.formatter.lineNumberIncrement,
      prettyPrintCommands: settings.formatter.prettyPrintCommands,
      prettyPrintNumbers: settings.formatter.prettyPrintNumbers,
      indent: settings.formatter.indent,
      compactOutput: settings.formatter.compactOutput,
      addProgramDelimiters: settings.formatter.addProgramDelimiters,
      indentSize: tabSize,
      useTabs: !insertSpaces,
    };

    // Parse and format
    const program = gcodeParser.parseGcode(text);
    gcodeFormatter.setOptions(formatterOptions);
    let formattedText = gcodeFormatter.format(program);

    // Add program delimiters if enabled
    if (formatterOptions.addProgramDelimiters) {
      const trimmedFormatted = formattedText.trim();

      // Check if formatted text starts with % (ignoring leading whitespace)
      const startsWithDelimiter = trimmedFormatted.startsWith(
        GCODE_SYMBOLS.PROGRAM_DELIMITER
      );
      // Check if formatted text ends with % (ignoring trailing whitespace)
      const endsWithDelimiter = trimmedFormatted.endsWith(
        GCODE_SYMBOLS.PROGRAM_DELIMITER
      );

      // Add delimiter at the beginning if not present
      if (!startsWithDelimiter) {
        formattedText =
          GCODE_SYMBOLS.PROGRAM_DELIMITER +
          GCODE_SYMBOLS.NEWLINE +
          formattedText;
      }

      // Add delimiter at the end if not present
      if (!endsWithDelimiter) {
        formattedText =
          formattedText +
          GCODE_SYMBOLS.NEWLINE +
          GCODE_SYMBOLS.PROGRAM_DELIMITER;
      }
    }

    // Return a single edit replacing the entire document
    // Get the length of the last line to properly replace the entire document
    const lastLine = document.lineCount - 1;
    const lastLineLength =
      document.getText().split(/\r?\n/)[lastLine]?.length ?? 0;
    const fullRange = Range.create(0, 0, lastLine, lastLineLength);

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

/**
 * Handle hover requests to show variable information or G/M code descriptions
 */
connection.onHover(
  async (params: HoverParams): Promise<Hover | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    try {
      const text = document.getText();
      const program = gcodeParser.parseGcode(text);

      return hoverProvider.getHover(program, params.position);
    } catch (error) {
      connection.console.error(
        `Hover error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    }
  }
);

/**
 * Handle definition requests for Ctrl+click navigation
 */
connection.onDefinition(
  async (
    params: DefinitionParams
  ): Promise<DefinitionLink[] | Location[] | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    try {
      const text = document.getText();
      const program = gcodeParser.parseGcode(text);
      const variableAtPosition =
        variableTracker.getProgramVariableAtPosition(
          program,
          params.position
        );

      if (variableAtPosition) {
        // We're at the declaration - find all usages
        const references = program.getVariableReferenceForVariable(
          variableAtPosition.getId()
        );

        // If there are multiple usages (declaration + others), do nothing
        if (references.length > 1) {
          return null;
        }

        // If there's exactly one usage elsewhere (declaration + 1 usage = 2 total),
        // navigate to that usage
        const reference = references[0];

        if (reference) {
          const range = reference.getRange();

          return [
            {
              uri: params.textDocument.uri,
              range,
            },
          ];
        }

        // If only the declaration exists (1 usage), do nothing
        return null;
      }

      const variableReferenceAtPosition =
        variableTracker.getProgramVariableReferenceAtPosition(
          program,
          params.position
        );

      if (variableReferenceAtPosition) {
        const variable = program.getVariable(
          variableReferenceAtPosition.getId()
        );

        if (!variable) return null;

        // Return the variable definition's range, not the reference's range
        const range = variable.getRange();

        return [
          {
            uri: params.textDocument.uri,
            range,
          },
        ];
      }

      return null;
    } catch (error) {
      connection.console.error(
        `Definition error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    }
  }
);

/**
 * Handle references requests (Find All References)
 */
connection.onReferences(
  async (params: ReferenceParams): Promise<Location[] | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    try {
      const text = document.getText();
      const program = gcodeParser.parseGcode(text);
      const variableAtPosition =
        variableTracker.getProgramVariableAtPosition(
          program,
          params.position
        );
      const variableReferenceAtPosition =
        variableTracker.getProgramVariableReferenceAtPosition(
          program,
          params.position
        );

      let variableId: number | string | null = null;

      if (variableAtPosition) {
        variableId = variableAtPosition.getId();
      } else if (variableReferenceAtPosition) {
        variableId = variableReferenceAtPosition.getId();
      }

      if (!variableId) {
        return null;
      }

      const locations: Location[] = [];

      // Add the variable definition
      const variable = program.getVariable(variableId);
      if (variable) {
        locations.push({
          uri: params.textDocument.uri,
          range: variable.getRange(),
        });
      }

      // Add all references
      const references =
        program.getVariableReferenceForVariable(variableId);
      for (const reference of references) {
        locations.push({
          uri: params.textDocument.uri,
          range: reference.getRange(),
        });
      }

      return locations.length > 0 ? locations : null;
    } catch (error) {
      connection.console.error(
        `References error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    }
  }
);

/**
 * Handle rename requests (F2 or context menu)
 */
connection.onRenameRequest(
  async (params: RenameParams): Promise<WorkspaceEdit | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    try {
      const text = document.getText();
      const program = gcodeParser.parseGcode(text);
      const variableAtPosition =
        variableTracker.getProgramVariableAtPosition(
          program,
          params.position
        );
      const variableReferenceAtPosition =
        variableTracker.getProgramVariableReferenceAtPosition(
          program,
          params.position
        );

      // Determine which variable is being renamed
      let variableId: number | string | null = null;
      if (variableAtPosition) {
        variableId = variableAtPosition.getId();
      } else if (variableReferenceAtPosition) {
        variableId = variableReferenceAtPosition.getId();
      }

      if (!variableId) {
        return null;
      }

      // Get only the references for this specific variable
      const variable = program.getVariable(variableId);
      if (!variable) {
        return null;
      }

      // Format the new name based on variable type
      let formattedNewName: string;
      const newName = params.newName.trim();

      // Check if it's a named variable (string ID) or number variable (number ID)
      if (typeof variableId === "string") {
        // Named variable: format as #<name>
        formattedNewName = `${GCODE_SYMBOLS.NAMED_VAR_OPEN}${newName}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`;
      } else {
        // Number variable: format as #number
        // Try to parse as number, fallback to original if invalid
        const numValue = Number(newName);
        if (isNaN(numValue)) {
          // Invalid number, use the original format
          formattedNewName = variable.toString();
        } else {
          formattedNewName = `${GCODE_SYMBOLS.VARIABLE_PREFIX}${numValue}`;
        }
      }

      const variableReferences =
        program.getVariableReferenceForVariable(variableId);

      const edits: TextEdit[] = [];

      // Add edit for the variable definition
      const variableRange = variable.getRange();
      edits.push(TextEdit.replace(variableRange, formattedNewName));

      // Add edits for all references to this variable
      for (const variableReference of variableReferences) {
        const range = variableReference.getRange();
        edits.push(TextEdit.replace(range, formattedNewName));
      }

      return {
        changes: {
          [params.textDocument.uri]: edits,
        },
      };
    } catch (error) {
      connection.console.error(
        `Rename error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    }
  }
);

/**
 * Handle completion requests (Ctrl+Space or typing)
 */
connection.onCompletion(
  async (
    params: CompletionParams
  ): Promise<CompletionItem[] | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    try {
      const text = document.getText();
      const program = gcodeParser.parseGcode(text);
      const variables = variableTracker.getProgramVariables(program);

      const completionItems: CompletionItem[] = [];

      for (const variable of variables) {
        const varName = variable.toString();
        // const valueStr = assignment.getValue().toString();
        completionItems.push({
          label: varName,
          kind: CompletionItemKind.Variable,
          detail: `Value: ${varName}`,
          documentation: `Defined at ${
            variable.getPosition().line + 1
          }`,
          insertText: varName,
          // Sort numeric variables before named variables
          sortText: `0_${varName.padStart(6, "0")}`,
        });
      }

      return completionItems;
    } catch (error) {
      connection.console.error(
        `Completion error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return null;
    }
  }
);

/**
 * Handle semantic tokens requests for semantic highlighting
 */
connection.languages.semanticTokens.on(
  async (params: SemanticTokensParams): Promise<SemanticTokens> => {
    connection.console.log(
      `Semantic tokens requested for: ${params.textDocument.uri}`
    );

    const document = documents.get(params.textDocument.uri);
    if (!document) {
      connection.console.warn("Document not found for semantic tokens");
      return { data: [] };
    }

    try {
      const text = document.getText();
      const program = gcodeParser.parseGcode(text);
      const result =
        semanticTokensProvider.provideDocumentSemanticTokens(
          program,
          document
        );

      connection.console.log(
        `Semantic tokens returned: ${result.data.length} bytes (${
          result.data.length / 5
        } tokens)`
      );

      // Decode and log sample tokens to verify they're correct
      if (result.data.length > 0) {
        const legend = SEMANTIC_TOKENS_LEGEND;
        let currentLine = 0;
        let currentChar = 0;
        const sampleTokens: string[] = [];

        for (let i = 0; i < Math.min(result.data.length, 15); i += 5) {
          const deltaLine = result.data[i];
          const deltaStart = result.data[i + 1];
          const tokenLength = result.data[i + 2];
          const tokenType = result.data[i + 3];
          const tokenModifiers = result.data[i + 4];

          currentLine += deltaLine;
          if (deltaLine === 0) {
            currentChar += deltaStart;
          } else {
            currentChar = deltaStart;
          }

          const typeName = legend.tokenTypes[tokenType] || "unknown";
          const modifiers: string[] = [];
          for (let j = 0; j < legend.tokenModifiers.length; j++) {
            if (tokenModifiers & (1 << j)) {
              modifiers.push(legend.tokenModifiers[j]);
            }
          }

          sampleTokens.push(
            `L${currentLine}:C${currentChar}+${tokenLength} ${typeName}${
              modifiers.length > 0 ? ` [${modifiers.join(",")}]` : ""
            }`
          );
        }

        connection.console.log(
          `Sample tokens: ${sampleTokens.join(", ")}`
        );
      }

      return result;
    } catch (error) {
      connection.console.error(
        `Semantic tokens error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      if (error instanceof Error) {
        connection.console.error(`Stack: ${error.stack}`);
      }
      return { data: [] };
    }
  }
);

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
