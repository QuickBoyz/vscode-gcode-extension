/**
 * Function Completion Strategy
 *
 * Provides completions for built-in G-code functions (SIN, COS, ABS, etc.)
 * with snippet brackets for the argument.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node';

import { CompletionItemTypes, GCodeSymbols, DialectType } from '../../constants';
import { GCodeSettings } from '../DocumentStateManager';
import { IDocumentStateManager } from '../IDocumentStateManager';
import { ContextInfo } from '../CompletionContextDetector';
import { CompletionStrategy } from './CompletionStrategy';

export class FunctionCompletionStrategy implements CompletionStrategy {
  constructor(private readonly documentStateManager: IDocumentStateManager) {}

  provide(
    _document: TextDocument,
    contextInfo: ContextInfo,
    settings: GCodeSettings
  ): CompletionItem[] {
    const items: CompletionItem[] = [];
    const prefix = (contextInfo.prefix ?? GCodeSymbols.EMPTY_STRING).toUpperCase();
    const dialect = settings.dialect || DialectType.LINUXCNC;
    const dataProvider = this.documentStateManager.getDataProvider(dialect);
    const functions = dataProvider.getAllFunctions();

    for (const funcInfo of functions) {
      const funcName = funcInfo.name.toUpperCase();

      if (prefix && !funcName.startsWith(prefix)) continue;

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
          dialect,
        },
      });
    }

    return items;
  }
}
