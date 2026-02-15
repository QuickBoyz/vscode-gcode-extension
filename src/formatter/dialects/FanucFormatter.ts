import { GCodeKeywords, GCodeSymbols } from '../../constants';
import { BaseFormatter } from '../BaseFormatter';

/**
 * Fanuc-specific formatter.
 *
 * Fanuc control flow typically uses:
 * - M98/M99 for subprogram calls
 * - GOTO for jumps
 * - IF/WHILE are not standard Fanuc, but some modern Fanuc controllers support macro IF
 *
 * For compatibility with LinuxCNC-parsed AST, this formatter uses:
 * - IF [condition] THEN ... ELSE ... ENDIF (macro-style)
 * - WHILE [condition] DO ... END
 * - N-number labels (N100, N200, etc.)
 */
export class FanucFormatter extends BaseFormatter {
  protected formatLabel(label?: string): string {
    return label ? `${label?.toUpperCase()} ` : GCodeSymbols.EMPTY_STRING;
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
}
