import { SemanticTokensBuilder } from "vscode-languageserver/node";
import { Range } from "../parser/nodes";

export class GCodeSemanticTokensBuilder {
  private builder = new SemanticTokensBuilder();

  push(
    line: number,
    char: number,
    length: number,
    tokenTypeIndex: number,
    modifierMask = 0
  ) {
    this.builder.push(line, char, length, tokenTypeIndex, modifierMask);
  }

  pushRange(range: Range, tokenTypeIndex: number, modifierMask = 0) {
    this.builder.push(
      range.start.line,
      range.start.character,
      range.end.character - range.start.character,
      tokenTypeIndex,
      modifierMask
    );
  }

  build() {
    return this.builder.build();
  }
}
