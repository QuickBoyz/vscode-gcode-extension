import { AstTraverser } from '../parser/AstTraverser';
import { AstVisitor } from '../parser/AstVisitor';
import { ProgramNode } from '../parser/nodes';

/**
 * Formatter configuration options.
 */
export interface FormatterConfig {
  /** Add N-block line numbers to each line. */
  readonly addLineNumbers: boolean;
  /** Starting line number when addLineNumbers is true. */
  readonly lineNumberStart: number;
  /** Line number increment when addLineNumbers is true. */
  readonly lineNumberIncrement: number;
  /** Pretty-print G and M codes with two digits (G1 -> G01, M3 -> M03). */
  readonly prettyPrintCommands: boolean;
  /** Pretty-print parameter numbers to always have at least one decimal point (X2 -> X2.0). */
  readonly prettyPrintNumbers: boolean;
  /** Indentation size (number of spaces per indent level). */
  readonly indentSize: number;
  /** Use tabs instead of spaces for indentation. */
  readonly useTabs: boolean;
  /** Enable indentation for control structures (WHILE, IF, etc.). */
  readonly indent: boolean;
  /** Compact output mode - removes all empty lines. */
  readonly compactOutput: boolean;
  /** Add program delimiters (%) at the beginning and end of the program if not present. */
  readonly addProgramDelimiters: boolean;
}

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
export interface FormatterInterface extends AstVisitor<void> {
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
  setOptions(settings: Partial<FormatterConfig>): void;
}
