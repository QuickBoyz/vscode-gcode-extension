import { AstTraverser } from '../parser/AstTraverser';
import { AstVisitor } from '../parser/AstVisitor';
import { ProgramNode } from '../parser/nodes';
import { FormatterSettings } from './types';

/**
 * Interface for dialect-specific G-code formatters.
 *
 * Each dialect (LinuxCNC, Fanuc, Haas, Siemens) may have different:
 * - Control flow keywords (IF/THEN/ENDIF vs IF/ENDIF)
 * - Loop syntax (WHILE/DO/END vs WHILE/ENDWHILE)
 * - Label formats (O-numbers vs other schemes)
 * - Command formatting preferences
 *
 * Formatters must implement AstVisitor<void> to traverse the AST.
 */
export interface IFormatter extends AstVisitor<void> {
  /**
   * Format a G-code program AST to a string.
   * @param programNode - The root AST node to format
   * @param traverser - AST traverser configured with this formatter as visitor
   * @returns Formatted G-code string
   */
  formatGCode(programNode: ProgramNode, traverser: AstTraverser<void>): string;

  /**
   * Update formatter settings.
   * @param settings - Partial formatter settings to apply
   */
  setOptions(settings: Partial<FormatterSettings>): void;
}
