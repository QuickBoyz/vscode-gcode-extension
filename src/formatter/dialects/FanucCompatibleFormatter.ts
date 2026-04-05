import { GCodeKeywords, GCodeSymbols } from '../../constants';
import {
  ReturnStatementNode,
  SubroutineCallNode,
  SubroutineDefinitionNode,
} from '../../parser/nodes';
import { BaseFormatter } from '../BaseFormatter';

/**
 * Formatter for Fanuc-compatible dialects (Fanuc, Haas).
 *
 * Both Fanuc and Haas share identical control flow keyword formatting:
 * - IF [condition] THEN ... ELSE ... ENDIF (macro-style)
 * - WHILE [condition] DO ... END
 * - N-number labels
 * - M98/M99 for subprogram calls and returns
 */
export class FanucCompatibleFormatter extends BaseFormatter {
  protected formatLabel(label?: string): string {
    return label ? `${label.toUpperCase()} ` : GCodeSymbols.EMPTY_STRING;
  }

  protected getIfKeyword(): string {
    return GCodeKeywords.IF;
  }

  protected getElseIfKeyword(): string {
    return GCodeKeywords.ELSEIF;
  }

  protected getElseKeyword(): string {
    return GCodeKeywords.ELSE;
  }

  protected getEndIfKeyword(): string {
    return GCodeKeywords.ENDIF;
  }

  protected getThenKeyword(): string {
    return GCodeKeywords.THEN;
  }

  protected getWhileKeyword(): string {
    return GCodeKeywords.WHILE;
  }

  protected getDoKeyword(): string {
    return GCodeKeywords.DO;
  }

  protected getEndWhileKeyword(): string {
    return GCodeKeywords.END;
  }

  protected formatSubroutineDefinitionOpen(_node: SubroutineDefinitionNode): string {
    return GCodeSymbols.EMPTY_STRING;
  }

  protected formatSubroutineDefinitionClose(_node: SubroutineDefinitionNode): string {
    return GCodeSymbols.EMPTY_STRING;
  }

  protected formatSubroutineCallLine(node: SubroutineCallNode): string {
    let line = `${GCodeKeywords.M98} P${node.target}`;
    if (node.repeatCount) {
      line += ` L${this.expressionFormatter.format(node.repeatCount)}`;
    }
    return line;
  }

  protected formatReturnStatementLine(_node: ReturnStatementNode): string {
    return GCodeKeywords.M99;
  }
}
