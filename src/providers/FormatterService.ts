import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit } from "vscode-languageserver/node";
import { GCodeFormatter } from "../formatter/GCodeFormatter";
import { FormatterSettings } from "../formatter/types";
import { GCodeLexer } from "../lexer/GCodeLexer";
import { AstTraverser } from "../parser/AstTraverser";
import { GCodeParser } from "../parser/GCodeParser";
import { Range } from "../parser/nodes";

export class FormatterService {
  formatDocument(text: string, settings: FormatterSettings): string {
    const lexer = new GCodeLexer();
    const tokens = lexer.tokenize(text);
    const parser = new GCodeParser(tokens);
    const program = parser.parseProgram();
    const formatter = new GCodeFormatter(settings);
    const traverser = new AstTraverser(formatter);

    return formatter.formatGCode(program, traverser);
  }

  formatAsTextEdits(
    document: TextDocument,
    range: Range | null,
    settings: FormatterSettings
  ): TextEdit[] {
    const formatted = this.formatDocument(document.getText(), settings);

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
