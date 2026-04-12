/**
 * Parameter Completion Strategy
 *
 * Provides axis parameter completions (X, Y, Z, F, etc.) filtered by the
 * current command's supported parameters and already-used parameters on the line.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver/node';

import { CompletionItemTypes, GCodeSymbols, DialectType } from '../../constants';
import { GCodeSettings } from '../DocumentStateManager';
import { IDocumentStateManager } from '../IDocumentStateManager';
import { ContextInfo } from '../CompletionContextDetector';
import { CompletionStrategy } from './CompletionStrategy';

export class ParameterCompletionStrategy implements CompletionStrategy {
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

    let validParams: string[] = [];

    if (contextInfo.currentCommand) {
      const commandInfo = dataProvider.getCommandInfo(contextInfo.currentCommand);
      if (commandInfo) {
        if (commandInfo.parameters !== undefined && commandInfo.parameters !== null) {
          validParams = commandInfo.parameters;
        }
      }
    }

    if (validParams.length === 0) {
      return [];
    }

    for (const param of validParams) {
      if (contextInfo.usedParameters?.has(param)) {
        if (!prefix || !param.startsWith(prefix)) {
          continue;
        }
      }

      if (prefix && !param.startsWith(prefix)) continue;

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
          dialect,
        },
      });
    }

    return items;
  }
}
