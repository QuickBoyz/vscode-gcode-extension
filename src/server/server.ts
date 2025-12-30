/**
 * G-code Language Server
 *
 * Provides language features for G-code files using the Language Server Protocol (LSP).
 * Currently supports:
 * - Document formatting
 * - Range formatting
 * - Variable hover information
 * - Variable definition navigation
 * - Variable rename (F2 or context menu)
 * - Variable completion (Ctrl+Space)
 * - Semantic highlighting
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
  HoverParams,
  Hover,
  DefinitionParams,
  DefinitionLink,
  Location,
  RenameParams,
  WorkspaceEdit,
  CompletionParams,
  CompletionItem,
  CompletionItemKind,
  SemanticTokensParams,
  SemanticTokens,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { gcodeParser } from "../parser";
import { gcodeFormatter, GCodeFormatter } from "../formatter";
import { FormatterOptions } from "../formatter/types";
import { VariableTracker } from "./variableTracker";
import {
  SemanticTokensProvider,
  SEMANTIC_TOKENS_LEGEND,
} from "./semanticTokensProvider";
import {
  GCODE_SYMBOLS,
  REGEX_PATTERNS,
  DEFAULT_FORMATTER_OPTIONS,
} from "../constants";

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
  formatter: DEFAULT_FORMATTER_OPTIONS,
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

/**
 * Handle hover requests to show variable information
 */
connection.onHover(
  async (params: HoverParams): Promise<Hover | null> => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    try {
      const text = document.getText();
      const ast = gcodeParser.parseGcode(text);
      const definition = variableTracker.findDefinitionAtPosition(
        ast,
        document,
        params.position
      );

      if (!definition) {
        return null;
      }

      // Format variable identifier
      const varName =
        typeof definition.identifier === "string"
          ? GCodeFormatter.formatNamedVariable(definition.identifier)
          : GCodeFormatter.formatNumericVariable(definition.identifier);

      // Format value
      const valueStr = GCodeFormatter.formatExpression(definition.value);

      // Get line number for display (1-based)
      const lineNumber = definition.statement.lineNumber
        ? GCodeFormatter.formatLineNumber(
            definition.statement.lineNumber
          )
        : `Line ${definition.line + 1}`;

      // Build hover content
      const contents = [
        `**Variable:** \`${varName}\``,
        `**Value:** \`${valueStr}\``,
        `**Defined at:** ${lineNumber}`,
      ];

      // Find the variable range in the current line for highlighting
      const line = document.getText().split(REGEX_PATTERNS.NEWLINE)[
        params.position.line
      ];
      const varMatch = line.match(
        typeof definition.identifier === "string"
          ? new RegExp(
              `${
                GCODE_SYMBOLS.NAMED_VAR_OPEN
              }${definition.identifier.replace(
                REGEX_PATTERNS.REGEX_SPECIAL_CHARS,
                "\\$&"
              )}${GCODE_SYMBOLS.NAMED_VAR_CLOSE}`
            )
          : new RegExp(
              `${GCODE_SYMBOLS.VARIABLE_PREFIX}${definition.identifier}${REGEX_PATTERNS.WORD_BOUNDARY}`
            )
      );

      let range: Range | undefined;
      if (varMatch && varMatch.index !== undefined) {
        range = Range.create(
          params.position.line,
          varMatch.index,
          params.position.line,
          varMatch.index + varMatch[0].length
        );
      }

      return {
        contents: {
          kind: "markdown",
          value: contents.join(
            `${GCODE_SYMBOLS.NEWLINE}${GCODE_SYMBOLS.NEWLINE}`
          ),
        },
        range,
      };
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
      const ast = gcodeParser.parseGcode(text);
      const definition = variableTracker.findDefinitionAtPosition(
        ast,
        document,
        params.position
      );

      if (!definition) {
        return null;
      }

      // Check if we're clicking on the definition itself
      const isAtDefinition =
        params.position.line === definition.line &&
        params.position.character >= definition.column &&
        params.position.character <
          definition.column +
            (typeof definition.identifier === "string"
              ? GCodeFormatter.formatNamedVariable(
                  definition.identifier
                ).length
              : GCodeFormatter.formatNumericVariable(
                  definition.identifier
                ).length);

      if (isAtDefinition) {
        // We're at the definition - find all usages
        const usages = variableTracker.findUsages(
          ast,
          document,
          definition.identifier
        );

        // If there are multiple usages (definition + others), do nothing
        if (usages.length > 2) {
          return null;
        }

        // If there's exactly one usage elsewhere (definition + 1 usage = 2 total),
        // navigate to that usage
        if (usages.length === 2) {
          // Find the usage that's not the definition
          const usage = usages.find(
            (u) =>
              !(
                u.line === definition.line &&
                u.character === definition.column
              )
          );

          if (usage) {
            const range = Range.create(
              usage.line,
              usage.character,
              usage.line,
              usage.character + usage.length
            );

            return [
              {
                uri: params.textDocument.uri,
                range,
              },
            ];
          }
        }

        // If only the definition exists (1 usage), do nothing
        return null;
      }

      // We're not at the definition - navigate to it (normal behavior)
      const range = Range.create(
        definition.line,
        definition.column,
        definition.line,
        definition.column +
          (typeof definition.identifier === "string"
            ? `#<${definition.identifier}>`.length
            : `#${definition.identifier}`.length)
      );

      return [
        {
          uri: params.textDocument.uri,
          range,
        },
      ];
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
      const ast = gcodeParser.parseGcode(text);

      // Find the variable at the position
      const variable = variableTracker.findDefinitionAtPosition(
        ast,
        document,
        params.position
      );

      if (!variable) {
        // Try to find variable usage if not at definition
        const line = document.getText().split(/\r?\n/)[
          params.position.line
        ];
        if (!line) return null;

        const varAtPos = variableTracker.findVariableAtPosition(
          line,
          params.position.character
        );
        if (!varAtPos) return null;

        // Find definition to get the identifier
        const definitions = variableTracker.findDefinitions(
          ast,
          document
        );
        const def = definitions.find((d) => {
          if (
            typeof varAtPos.identifier === "string" &&
            typeof d.identifier === "string"
          ) {
            return varAtPos.identifier === d.identifier;
          }
          if (
            typeof varAtPos.identifier === "number" &&
            typeof d.identifier === "number"
          ) {
            return varAtPos.identifier === d.identifier;
          }
          return false;
        });

        if (!def) return null;

        // Find all usages
        const usages = variableTracker.findUsages(
          ast,
          document,
          def.identifier
        );

        // Validate new name
        const newName = params.newName.trim();
        if (typeof def.identifier === "string") {
          // Named variable: validate name format
          if (!REGEX_PATTERNS.VALID_NAMED_VARIABLE.test(newName)) {
            connection.window.showErrorMessage(
              "Invalid variable name. Must start with a letter or underscore and contain only letters, numbers, and underscores."
            );
            return null;
          }
        } else {
          // Numeric variable: validate it's a number
          if (!REGEX_PATTERNS.VALID_NUMERIC_VARIABLE.test(newName)) {
            connection.window.showErrorMessage(
              "Invalid variable number. Must be a positive integer."
            );
            return null;
          }
        }

        // Create text edits for all usages
        const edits: TextEdit[] = usages.map((usage) => {
          const range = Range.create(
            usage.line,
            usage.character,
            usage.line,
            usage.character + usage.length
          );

          // Format new variable name
          const newVarName =
            typeof def.identifier === "string"
              ? GCodeFormatter.formatNamedVariable(newName)
              : GCodeFormatter.formatNumericVariable(Number(newName));

          return TextEdit.replace(range, newVarName);
        });

        return {
          changes: {
            [params.textDocument.uri]: edits,
          },
        };
      }

      // We're at the definition, find all usages
      const usages = variableTracker.findUsages(
        ast,
        document,
        variable.identifier
      );

      // Validate new name
      const newName = params.newName.trim();
      if (typeof variable.identifier === "string") {
        // Named variable: validate name format
        if (!REGEX_PATTERNS.VALID_NAMED_VARIABLE.test(newName)) {
          connection.window.showErrorMessage(
            "Invalid variable name. Must start with a letter or underscore and contain only letters, numbers, and underscores."
          );
          return null;
        }
      } else {
        // Numeric variable: validate it's a number
        if (!REGEX_PATTERNS.VALID_NUMERIC_VARIABLE.test(newName)) {
          connection.window.showErrorMessage(
            "Invalid variable number. Must be a positive integer."
          );
          return null;
        }
      }

      // Create text edits for all usages (including definition)
      const edits: TextEdit[] = usages.map((usage) => {
        const range = Range.create(
          usage.line,
          usage.character,
          usage.line,
          usage.character + usage.length
        );

        // Format new variable name
        const newVarName =
          typeof variable.identifier === "string"
            ? GCodeFormatter.formatNamedVariable(newName)
            : GCodeFormatter.formatNumericVariable(Number(newName));

        return TextEdit.replace(range, newVarName);
      });

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
      const ast = gcodeParser.parseGcode(text);
      const definitions = variableTracker.findDefinitions(
        ast,
        document
      );

      const completionItems: CompletionItem[] = [];

      for (const definition of definitions) {
        const varName =
          typeof definition.identifier === "string"
            ? GCodeFormatter.formatNamedVariable(definition.identifier)
            : GCodeFormatter.formatNumericVariable(
                definition.identifier
              );

        const valueStr = GCodeFormatter.formatExpression(definition.value);

        // Get line number for display
        const lineNumber = definition.statement.lineNumber
          ? GCodeFormatter.formatLineNumber(
              definition.statement.lineNumber
            )
          : `Line ${definition.line + 1}`;

        completionItems.push({
          label: varName,
          kind: CompletionItemKind.Variable,
          detail: `Value: ${valueStr}`,
          documentation: `Defined at ${lineNumber}`,
          insertText: varName,
          // Sort numeric variables before named variables
          sortText:
            typeof definition.identifier === "string"
              ? `1_${definition.identifier}`
              : `0_${definition.identifier
                  .toString()
                  .padStart(6, "0")}`,
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
      const ast = gcodeParser.parseGcode(text);
      const result =
        semanticTokensProvider.provideDocumentSemanticTokens(
          ast,
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
