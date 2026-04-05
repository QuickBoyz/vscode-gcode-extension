import { GCodeSymbols } from '../../constants';
import {
  ReturnStatementNode,
  SubroutineCallNode,
  SubroutineDefinitionNode,
} from '../../parser/nodes';
import { BaseFormatter } from '../BaseFormatter';

/**
 * Siemens/Sinumerik-specific formatter.
 *
 * Siemens control flow syntax differs from LinuxCNC:
 * - IF condition ... ELSEIF condition ... ELSE ... ENDIF (no THEN keyword)
 * - WHILE condition ... ENDWHILE (no DO keyword)
 * - REPEAT ... UNTIL condition
 * - FOR variable = start TO end ... ENDFOR
 * - Different variable syntax: R parameters (R1, R2) instead of # variables
 *
 * This formatter implements the Siemens-style control flow keywords.
 */
export class SiemensFormatter extends BaseFormatter {
  protected formatLabel(label?: string): string {
    // Siemens uses labels with colon: LABEL1:
    return label ? `${label.toUpperCase()}: ` : GCodeSymbols.EMPTY_STRING;
  }

  protected getIfKeyword(): string {
    return 'IF';
  }

  protected getElseIfKeyword(): string {
    return 'ELSEIF';
  }

  protected getElseKeyword(): string {
    return 'ELSE';
  }

  protected getEndIfKeyword(): string {
    return 'ENDIF';
  }

  protected getThenKeyword(): string {
    // Siemens does NOT use THEN keyword
    return GCodeSymbols.EMPTY_STRING;
  }

  protected getWhileKeyword(): string {
    return 'WHILE';
  }

  protected getDoKeyword(): string {
    // Siemens does NOT use DO keyword
    return GCodeSymbols.EMPTY_STRING;
  }

  protected getEndWhileKeyword(): string {
    // Siemens uses ENDWHILE instead of END
    return 'ENDWHILE';
  }

  protected formatSubroutineDefinitionOpen(node: SubroutineDefinitionNode): string {
    return `PROC ${node.label}`;
  }

  protected formatSubroutineDefinitionClose(_node: SubroutineDefinitionNode): string {
    return 'RET';
  }

  protected formatSubroutineCallLine(node: SubroutineCallNode): string {
    return `CALL ${node.target}`;
  }

  protected formatReturnStatementLine(_node: ReturnStatementNode): string {
    return 'RET';
  }
}
