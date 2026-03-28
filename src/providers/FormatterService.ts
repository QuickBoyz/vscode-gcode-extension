import { TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { FormatterFactory } from '../formatter/FormatterFactory';
import { FormatterConfig } from '../config/types';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { AstTraverser } from '../parser/AstTraverser';
import { GCodeParser } from '../parser/GCodeParser';
import { Range } from '../parser/nodes';
import { DialectType } from '../constants';
import { ErrorDetectorVisitor } from './ErrorDetectorVisitor';

export class FormatterService {
  formatDocument(text: string, settings: FormatterConfig, dialect?: DialectType): string {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(text),
      parser = new GCodeParser(tokens, text),
      program = parser.parseProgram();

    // Check for syntax errors and block formatting if any exist
    // This matches VS Code's built-in JavaScript formatter behavior
    const errorDetector = new ErrorDetectorVisitor();
    if (errorDetector.hasErrors(program)) {
      // Return original text unchanged when errors exist
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
