/**
 * Expression Completion Strategy
 *
 * Provides completions inside expression brackets: variables, functions, and operators.
 * Composes VariableCompletionStrategy and FunctionCompletionStrategy for reuse.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';

import { CompletionItemTypes, OPERATORS_SORT_PREFIX, DialectType } from '../../constants';
import { DocumentStateManager, GCodeSettings } from '../DocumentStateManager';
import { ContextInfo } from '../CompletionContextDetector';
import { CompletionStrategy } from './CompletionStrategy';
import { VariableCompletionStrategy } from './VariableCompletionStrategy';
import { FunctionCompletionStrategy } from './FunctionCompletionStrategy';

export class ExpressionCompletionStrategy implements CompletionStrategy {
  private readonly variableStrategy: VariableCompletionStrategy;
  private readonly functionStrategy: FunctionCompletionStrategy;

  constructor(private readonly documentStateManager: DocumentStateManager) {
    this.variableStrategy = new VariableCompletionStrategy(documentStateManager);
    this.functionStrategy = new FunctionCompletionStrategy(documentStateManager);
  }

  provide(
    document: TextDocument,
    contextInfo: ContextInfo,
    settings: GCodeSettings
  ): CompletionItem[] {
    const items: CompletionItem[] = [];
    const dialect = settings.dialect || DialectType.LINUXCNC;
    const dataProvider = this.documentStateManager.getDataProvider(dialect);

    items.push(...this.variableStrategy.provide(document, contextInfo, settings));
    items.push(...this.functionStrategy.provide(document, contextInfo, settings));

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
          dialect,
        },
      });
    }

    return items;
  }
}
