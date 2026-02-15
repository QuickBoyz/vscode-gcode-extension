import { TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { FormatterFactory } from '../formatter/FormatterFactory';
import { FormatterSettings } from '../formatter/types';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { AstTraverser } from '../parser/AstTraverser';
import { GCodeParser } from '../parser/GCodeParser';
import { Range } from '../parser/nodes';
import { DialectType } from '../constants';

export class FormatterService {
  formatDocument(text: string, settings: FormatterSettings, dialect?: DialectType): string {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(text),
      parser = new GCodeParser(tokens, text),
      program = parser.parseProgram(),
      formatter = dialect
        ? FormatterFactory.create(dialect, settings)
        : FormatterFactory.createDefault(settings),
      traverser = new AstTraverser(formatter);

    return formatter.formatGCode(program, traverser);
  }

  formatAsTextEdits(
    document: TextDocument,
    range: Range | null,
    settings: FormatterSettings,
    dialect?: DialectType
  ): TextEdit[] {
    const formatted = this.formatDocument(document.getText(), settings, dialect);

    return [
      TextEdit.replace(
        range ??
          Range.create(
            0,
            0,
            document.positionAt(document.getText().length).line,
            document.positionAt(document.getText().length).character
          ),
        formatted
      ),
    ];
  }
}
