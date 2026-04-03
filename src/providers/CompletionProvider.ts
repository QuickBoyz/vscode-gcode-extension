/**
 * Completion Provider
 *
 * Provides IntelliSense-style code completion for G-Code:
 * - G/M commands with descriptions
 * - Axis parameters filtered by command context
 * - Variables from document analysis
 * - Functions (SIN, COS, ABS, etc.)
 * - Operators (EQ, NE, LT, etc.)
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  Position,
} from 'vscode-languageserver/node';

import {
  CompletionItemTypes,
  OPERATORS_SORT_PREFIX,
  GCodeSymbols,
  DialectType,
  GROUP_SORT_ORDER,
  DEFAULT_GROUP_SORT_PREFIX,
  MAX_SNIPPET_PARAMETERS,
  getDialectKeywords,
} from '../constants';
import { DocumentStateManager, GCodeSettings } from './DocumentStateManager';
import { formatVariableName } from './RenameUtils';
import { DocumentationBuilder } from './DocumentationBuilder';
import { BaseProvider } from './BaseProvider';
import {
  CompletionContext,
  CompletionContextDetector,
  ContextInfo,
} from './CompletionContextDetector';

interface KnownCompletionItem extends CompletionItem {
  data: {
    type: CompletionItemTypes | (string & {});
    dialect?: DialectType;
    function?: string;
    parameter?: string;
    command?: string;
  };
}

/**
 * Completion Provider
 */
export class CompletionProvider extends BaseProvider {
  private readonly contextDetector: CompletionContextDetector;
  private readonly documentationBuilder = new DocumentationBuilder();

  constructor(documentStateManager: DocumentStateManager) {
    super(documentStateManager);
    this.contextDetector = new CompletionContextDetector(documentStateManager);
  }

  /**
   * Provide completion items for a position in the document
   */
  provideCompletionItems(
    document: TextDocument,
    position: Position,
    settings: GCodeSettings
  ): CompletionItem[] {
    const contextInfo = this.contextDetector.detect(document, position, settings);

    switch (contextInfo.type) {
      case CompletionContext.COMMAND:
        return this.provideCommandCompletions(contextInfo, settings);
      case CompletionContext.PARAMETER:
        return this.provideParameterCompletions(contextInfo, settings);
      case CompletionContext.VARIABLE:
        return this.provideVariableCompletions(document, settings);
      case CompletionContext.FUNCTION:
        return this.provideFunctionCompletions(contextInfo, settings);
      case CompletionContext.EXPRESSION:
        return this.provideExpressionCompletions(document, settings, contextInfo);
      case CompletionContext.KEYWORD:
        return this.provideKeywordCompletions(contextInfo, settings);
      default:
        return [];
    }
  }

  /**
   * Resolve completion item with full documentation (lazy loading)
   */
  resolveCompletionItem(item: CompletionItem): CompletionItem {
    // If item has data with command info, load full documentation
    if (this.isKnownCompletionItem(item)) {
      const data = item.data;
      const dataProvider = this.getDataProvider(data.dialect);

      if (item.data.type === CompletionItemTypes.COMMAND && data.command) {
        const commandInfo = dataProvider.getCommandInfo(data.command);
        if (commandInfo) {
          item.documentation = this.documentationBuilder.buildCommandDocumentation(commandInfo);
        }
      }

      if (data.type === CompletionItemTypes.FUNCTION && data.function) {
        const functionInfo = dataProvider.getFunctionInfo(data.function);
        if (functionInfo) {
          item.documentation = this.documentationBuilder.buildFunctionDocumentation(functionInfo);
        }
      }

      if (data.type === CompletionItemTypes.PARAMETER && data.parameter) {
        const paramInfo = dataProvider.getAxisParameterInfo(data.parameter);
        if (paramInfo) {
          item.documentation = this.documentationBuilder.buildParameterDocumentation(paramInfo);
        }
      }
    }

    return item;
  }

  private isKnownCompletionItem(item: CompletionItem): item is KnownCompletionItem {
    return !!item.data && typeof item.data === 'object' && 'type' in item.data;
  }

  /**
   * Provide G/M command completions
   */
  private provideCommandCompletions(
    contextInfo: ContextInfo,
    settings: GCodeSettings
  ): CompletionItem[] {
    const items: CompletionItem[] = [];
    const prefix = (contextInfo.prefix ?? GCodeSymbols.EMPTY_STRING).toUpperCase();
    const dialect = settings.dialect || DialectType.LINUXCNC;
    const dataProvider = this.getDataProvider(dialect);

    // Get all commands from database
    const commands = dataProvider.getAllCommands();

    for (const commandInfo of commands) {
      const command = commandInfo.command.toUpperCase();

      // Filter by prefix
      if (
        this.is(prefix, GCodeSymbols.GCODE_PREFIX) &&
        !this.is(command, GCodeSymbols.GCODE_PREFIX)
      )
        continue;
      if (
        this.is(prefix, GCodeSymbols.MCODE_PREFIX) &&
        !this.is(command, GCodeSymbols.MCODE_PREFIX)
      )
        continue;
      if (prefix && !this.is(command, prefix)) continue;

      // Build snippet with parameter tab stops if command has parameters
      let insertText = command;
      let insertTextFormat: InsertTextFormat | undefined;
      if (commandInfo.parameters && commandInfo.parameters.length > 0) {
        const params = commandInfo.parameters
          .slice(0, MAX_SNIPPET_PARAMETERS)
          .map((p, i) => `${p}\${${i + 1}}`)
          .join(' ');
        insertText = `${command} ${params}`;
        insertTextFormat = InsertTextFormat.Snippet;
      }

      // Use example as detail, falling back to command name
      const detail = commandInfo.example ?? commandInfo.name;

      // Group-based sort order
      const groupPrefix = GROUP_SORT_ORDER[commandInfo.group ?? ''] ?? DEFAULT_GROUP_SORT_PREFIX;
      const sortText = `${groupPrefix}_${command}`;

      items.push({
        label: command,
        kind: CompletionItemKind.Keyword,
        detail,
        documentation: commandInfo.description,
        insertText,
        insertTextFormat,
        sortText,
        data: {
          type: CompletionItemTypes.COMMAND,
          command,
          dialect,
        },
      });
    }

    return items;
  }

  private is(text: string, symbol: string) {
    return text.startsWith(symbol);
  }

  /**
   * Provide axis parameter completions
   */
  private provideParameterCompletions(
    contextInfo: ContextInfo,
    settings: GCodeSettings
  ): CompletionItem[] {
    const items: CompletionItem[] = [];
    const prefix = (contextInfo.prefix ?? GCodeSymbols.EMPTY_STRING).toUpperCase();
    const dialect = settings.dialect || 'linuxcnc';
    const dataProvider = this.getDataProvider(settings.dialect);

    // Get valid parameters for the current command
    let validParams: string[] = [];

    if (contextInfo.currentCommand) {
      const commandInfo = dataProvider.getCommandInfo(contextInfo.currentCommand);
      if (commandInfo) {
        // Use command-specific parameters if defined
        // If command has empty parameters array, show no suggestions (e.g., G17, G18)
        // If command has undefined/null parameters, fall back to common parameters
        if (commandInfo.parameters !== undefined && commandInfo.parameters !== null) {
          validParams = commandInfo.parameters;
        }
      }
    }

    // If no valid parameters (e.g., G17), return empty list
    if (validParams.length === 0) {
      return [];
    }

    for (const param of validParams) {
      // Skip if already used (unless it's the one being typed with a non-empty prefix)
      if (contextInfo.usedParameters?.has(param)) {
        // Allow completing the same parameter if we have a prefix that matches
        if (!prefix || !this.is(param, prefix)) {
          continue;
        }
      }

      // Filter by prefix
      if (prefix && !this.is(param, prefix)) continue;

      const paramInfo = dataProvider.getAxisParameterInfo(param);

      items.push({
        label: param,
        kind: CompletionItemKind.Property,
        detail: paramInfo?.name || `${param} Parameter`,
        documentation: paramInfo?.description,
        insertText: param,
        data: {
          type: CompletionItemTypes.PARAMETER,
          parameter: param,
          dialect: dialect,
        },
      });
    }

    return items;
  }

  /**
   * Provide variable completions
   */
  private provideVariableCompletions(
    document: TextDocument,
    settings: GCodeSettings
  ): CompletionItem[] {
    const items: CompletionItem[] = [];

    // Get analysis results with variables
    const analysis = this.getAnalysis(document, settings);

    // Add all defined variables
    for (const [varName, symbol] of analysis.variables) {
      if (symbol.definitions.length === 0) continue; // Skip undeclared variables

      const displayName = formatVariableName(varName);

      items.push({
        label: displayName,
        kind: CompletionItemKind.Variable,
        detail: `${symbol.references.length} reference${symbol.references.length !== 1 ? 's' : ''}`,
        insertText: displayName,
      });
    }

    return items;
  }

  /**
   * Provide function completions
   */
  private provideFunctionCompletions(
    contextInfo: ContextInfo,
    settings: GCodeSettings
  ): CompletionItem[] {
    const items: CompletionItem[] = [];
    const prefix = (contextInfo.prefix ?? GCodeSymbols.EMPTY_STRING).toUpperCase();
    const dialect = settings.dialect || 'linuxcnc';
    const dataProvider = this.getDataProvider(settings.dialect);

    const functions = dataProvider.getAllFunctions();

    for (const funcInfo of functions) {
      const funcName = funcInfo.name.toUpperCase();

      // Filter by prefix
      if (prefix && !this.is(funcName, prefix)) continue;

      items.push({
        label: funcName,
        kind: CompletionItemKind.Function,
        detail: funcInfo.signature,
        documentation: funcInfo.description,
        insertText: `${funcName}[$0]`,
        insertTextFormat: InsertTextFormat.Snippet,
        data: {
          type: CompletionItemTypes.FUNCTION,
          function: funcName,
          dialect: dialect,
        },
      });
    }

    return items;
  }

  /**
   * Provide expression completions (variables, functions, operators)
   */
  private provideExpressionCompletions(
    document: TextDocument,
    settings: GCodeSettings,
    contextInfo: ContextInfo
  ): CompletionItem[] {
    const items: CompletionItem[] = [];
    const dialect = settings.dialect || 'linuxcnc';
    const dataProvider = this.getDataProvider(settings.dialect);

    // Add variables
    items.push(...this.provideVariableCompletions(document, settings));

    // Add functions
    items.push(...this.provideFunctionCompletions(contextInfo, settings));

    // Add operators
    const operators = dataProvider.getAllOperators();
    for (const opInfo of operators) {
      items.push({
        label: opInfo.operator,
        kind: CompletionItemKind.Operator,
        detail: opInfo.name,
        documentation: opInfo.description,
        insertText: opInfo.operator,
        sortText: OPERATORS_SORT_PREFIX + opInfo.operator,
        data: {
          type: CompletionItemTypes.OPERATOR,
          dialect: dialect,
        },
      });
    }

    return items;
  }

  /**
   * Provide keyword completions for control flow and subroutine keywords
   */
  private provideKeywordCompletions(
    contextInfo: ContextInfo,
    settings: GCodeSettings
  ): CompletionItem[] {
    const items: CompletionItem[] = [];
    const prefix = (contextInfo.prefix ?? GCodeSymbols.EMPTY_STRING).toUpperCase();
    const dialect = settings.dialect || DialectType.LINUXCNC;
    const keywords = getDialectKeywords(dialect);

    for (const keyword of keywords) {
      // Filter by prefix
      if (prefix && !keyword.startsWith(prefix)) continue;

      items.push({
        label: keyword,
        kind: CompletionItemKind.Keyword,
        detail: 'Keyword',
        insertText: keyword,
        data: {
          type: CompletionItemTypes.KEYWORD,
          dialect,
        },
      });
    }

    return items;
  }
}
