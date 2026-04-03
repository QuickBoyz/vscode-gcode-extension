import { TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { FormatterFactory } from '../formatter/FormatterFactory';
import { LexerFactory } from '../lexer/LexerFactory';
import { AstTraverser } from '../parser/AstTraverser';
import { Range } from '../parser/nodes';
import { ParserFactory } from '../parser/ParserFactory';
import { DialectType } from '../constants';
import { ErrorDetectorVisitor } from './ErrorDetectorVisitor';
import { FormatterConfig } from '../formatter/types';

export class FormatterService {
  /**
   * Format a document from raw text.
   *
   * Always parses with LinuxCNC dialect (superset of all keywords).
   * The dialect parameter only affects formatter output, not parsing.
   */
  formatDocument(text: string, settings: FormatterConfig, dialect?: DialectType): string {
    const lexer = LexerFactory.create(DialectType.LINUXCNC),
      tokens = lexer.tokenize(text),
      parser = ParserFactory.create(DialectType.LINUXCNC, tokens, text),
      program = parser.parseProgram();

    // Check for syntax errors and block formatting if any exist
    const errorDetector = new ErrorDetectorVisitor();
    if (errorDetector.hasErrors(program)) {
      return text;
    }

    const formatter = dialect
        ? FormatterFactory.create(dialect, settings)
        : FormatterFactory.createDefault(settings),
      traverser = new AstTraverser(formatter);

    return formatter.formatGCode(program, traverser);
  }

  formatAsTextEdits(
    document: TextDocument,
    range: Range | null,
    settings: FormatterConfig,
    dialect?: DialectType
  ): TextEdit[] {
    const text = document.getText();
    const formatted = this.formatDocument(text, settings, dialect);

    return [
      TextEdit.replace(
        range ??
          Range.create(
            0,
            0,
            document.positionAt(text.length).line,
            document.positionAt(text.length).character
          ),
        formatted
      ),
    ];
  }
}
