import { TextDocument } from "vscode-languageserver-textdocument";
import { TextEdit } from "vscode-languageserver/node";
import { FormatterSettings } from "../formatter/types";
import { Range } from "../parser/nodes";
import { FormatterService } from "./FormatterService";

export class DocumentRangeFormattingProvider {
  constructor(private formatter: FormatterService) {}

  provide(
    document: TextDocument,
    range: Range,
    settings: FormatterSettings
  ): TextEdit[] {
    return this.formatter.formatAsTextEdits(document, range, settings);
  }
}
