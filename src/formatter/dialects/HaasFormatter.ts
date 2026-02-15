import { GCodeKeywords, GCodeSymbols } from '../../constants';
import { BaseFormatter } from '../BaseFormatter';

/**
 * Haas-specific formatter.
 *
 * Haas control flow typically uses:
 * - M97 for local subprogram calls
 * - M98/M99 for external subprogram calls
 * - M95-M99 for conditional jumps and labels
 *
 * Haas does not have structured IF/WHILE like LinuxCNC.
 * For compatibility with LinuxCNC-parsed AST, this formatter uses:
 * - IF [condition] THEN ... ELSE ... ENDIF
 * - WHILE [condition] DO ... END
 * - N-number labels
 */
export class HaasFormatter extends BaseFormatter {
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
