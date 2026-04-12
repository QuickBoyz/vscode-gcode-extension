/**
 * Command Completion Strategy
 *
 * Provides G/M command completions with snippet tab-stops, example details,
 * and group-based sort ordering.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node';

import {
  CompletionItemTypes,
  GCodeSymbols,
  DialectType,
  MAX_SNIPPET_PARAMETERS,
} from '../../constants';
import { GROUP_SORT_ORDER, DEFAULT_GROUP_SORT_PREFIX } from '../../databases/types';
import { GCodeSettings } from '../DocumentStateManager';
import { IDocumentStateManager } from '../IDocumentStateManager';
import { ContextInfo } from '../CompletionContextDetector';
import { CompletionStrategy } from './CompletionStrategy';

export class CommandCompletionStrategy implements CompletionStrategy {
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
    const commands = dataProvider.getAllCommands();

    for (const commandInfo of commands) {
      const command = commandInfo.command.toUpperCase();

      if (
        this.startsWith(prefix, GCodeSymbols.GCODE_PREFIX) &&
        !this.startsWith(command, GCodeSymbols.GCODE_PREFIX)
      )
        continue;
      if (
        this.startsWith(prefix, GCodeSymbols.MCODE_PREFIX) &&
        !this.startsWith(command, GCodeSymbols.MCODE_PREFIX)
      )
        continue;
      if (prefix && !this.startsWith(command, prefix)) continue;

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

      // detail = parameter signature (like a type signature in TS), fallback to name
      const detail =
        commandInfo.parameters && commandInfo.parameters.length > 0
          ? `${command} ${commandInfo.parameters.join(' ')}`
          : commandInfo.name;
      const groupPrefix = commandInfo.group
        ? (GROUP_SORT_ORDER[commandInfo.group] ?? DEFAULT_GROUP_SORT_PREFIX)
        : DEFAULT_GROUP_SORT_PREFIX;
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

  private startsWith(text: string, symbol: string): boolean {
    return text.startsWith(symbol);
  }
}
