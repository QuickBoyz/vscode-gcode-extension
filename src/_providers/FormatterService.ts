import { Range, TextEdit } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { GCodeFormatter } from "../_formatter/GCodeFormatter";
import { AstTraverser } from "../_parser/AstTraverser";
import { GCodeParser } from "../_parser/GCodeParser";
import { FormatterSettings } from "../formatter/types";
import { gcodeLexer } from "../lexer/gcodeLexer";

export class FormatterService {
  formatDocument(text: string, settings: FormatterSettings): string {
    const tokens = gcodeLexer.tokenize(text);
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
            { line: 0, character: 0 },
            document.positionAt(document.getText().length)
          ),
        formatted
      ),
    ];
  }
}
