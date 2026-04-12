/**
 * Completion Provider
 *
 * Orchestrates IntelliSense-style code completion for G-Code by delegating
 * to context-specific CompletionStrategy implementations:
 * - CommandCompletionStrategy — G/M commands with snippets and group sorting
 * - ParameterCompletionStrategy — Axis parameters filtered by current command
 * - VariableCompletionStrategy — Document-defined variables
 * - FunctionCompletionStrategy — Built-in functions (SIN, COS, etc.)
 * - ExpressionCompletionStrategy — Variables + functions + operators inside brackets
 * - KeywordCompletionStrategy — Dialect-specific control flow keywords
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, Position } from 'vscode-languageserver/node';

import { CompletionItemTypes, DialectType } from '../constants';
import { GCodeSettings } from './DocumentStateManager';
import { IDocumentStateManager } from './IDocumentStateManager';
import { DocumentationBuilder } from './DocumentationBuilder';
import { BaseProvider } from './BaseProvider';
import { CompletionContext, CompletionContextDetector } from './CompletionContextDetector';
import {
  CompletionStrategy,
  CommandCompletionStrategy,
  ParameterCompletionStrategy,
  VariableCompletionStrategy,
  FunctionCompletionStrategy,
  ExpressionCompletionStrategy,
  KeywordCompletionStrategy,
} from './completion';

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
  private readonly strategies: ReadonlyMap<CompletionContext, CompletionStrategy>;

  constructor(documentStateManager: IDocumentStateManager) {
    super(documentStateManager);
    this.contextDetector = new CompletionContextDetector(documentStateManager);
    this.strategies = new Map<CompletionContext, CompletionStrategy>([
      [CompletionContext.COMMAND, new CommandCompletionStrategy(documentStateManager)],
      [CompletionContext.PARAMETER, new ParameterCompletionStrategy(documentStateManager)],
      [CompletionContext.VARIABLE, new VariableCompletionStrategy(documentStateManager)],
      [CompletionContext.FUNCTION, new FunctionCompletionStrategy(documentStateManager)],
      [CompletionContext.EXPRESSION, new ExpressionCompletionStrategy(documentStateManager)],
      [CompletionContext.KEYWORD, new KeywordCompletionStrategy(documentStateManager)],
    ]);
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
    const strategy = this.strategies.get(contextInfo.type);

    if (!strategy) {
      return [];
    }

    return strategy.provide(document, contextInfo, settings);
  }

  /**
   * Resolve completion item with full documentation (lazy loading)
   */
  resolveCompletionItem(item: CompletionItem): CompletionItem {
    if (this.isKnownCompletionItem(item)) {
      const data = item.data;
      const dataProvider = this.getDataProvider(data.dialect);

      if (data.type === CompletionItemTypes.COMMAND && data.command) {
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
}
