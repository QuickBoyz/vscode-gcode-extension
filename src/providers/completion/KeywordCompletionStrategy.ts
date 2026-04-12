/**
 * Keyword Completion Strategy
 *
 * Provides completions for dialect-specific control flow and subroutine keywords
 * (IF, WHILE, SUB, PROC, etc.).
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';

import { CompletionItemTypes, GCodeSymbols, DialectType } from '../../constants';
import { GCodeSettings } from '../DocumentStateManager';
import { IDocumentStateManager } from '../IDocumentStateManager';
import { ContextInfo } from '../CompletionContextDetector';
import { CompletionStrategy } from './CompletionStrategy';

export class KeywordCompletionStrategy implements CompletionStrategy {
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
    const keywords = dataProvider.getAllKeywords();

    for (const keyword of keywords) {
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
