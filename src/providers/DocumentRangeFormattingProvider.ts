import { TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { FormatterSettings } from '../formatter/types';
import { Range } from '../parser/nodes';
import { FormatterService } from './FormatterService';
import { DialectType } from '../constants';

export class DocumentRangeFormattingProvider {
  constructor(private formatter: FormatterService) {}

  provide(
    document: TextDocument,
    range: Range,
    settings: FormatterSettings,
    dialect?: DialectType
  ): TextEdit[] {
    return this.formatter.formatAsTextEdits(document, range, settings, dialect);
  }
}
