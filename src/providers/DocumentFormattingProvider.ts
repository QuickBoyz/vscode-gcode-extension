import { TextDocument, TextEdit } from 'vscode-languageserver-textdocument';

import { FormatterSettings } from '../formatter/types';
import { FormatterService } from './FormatterService';
import { DialectType } from '../constants';

export class DocumentFormattingProvider {
  constructor(private formatter: FormatterService) {}

  provide(document: TextDocument, settings: FormatterSettings, dialect?: DialectType): TextEdit[] {
    return this.formatter.formatAsTextEdits(document, null, settings, dialect);
  }
}
