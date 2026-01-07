import {
  TextDocument,
  TextEdit,
} from "vscode-languageserver-textdocument";
import { FormatterSettings } from "../formatter/types";
import { FormatterService } from "./FormatterService";

export class DocumentFormattingProvider {
  constructor(private formatter: FormatterService) {}

  provide(
    document: TextDocument,
    settings: FormatterSettings
  ): TextEdit[] {
    return this.formatter.formatAsTextEdits(document, null, settings);
  }
}
