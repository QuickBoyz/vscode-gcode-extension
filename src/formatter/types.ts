/**
 * Formatter configuration options
 */
export interface FormatterSettings {
  /**
   * Add N-block line numbers to each line
   * @default false
   */
  addLineNumbers: boolean;

  /**
   * Starting line number when addLineNumbers is true
   * @default 10
   */
  lineNumberStart: number;

  /**
   * Line number increment when addLineNumbers is true
   * @default 10
   */
  lineNumberIncrement: number;

  /**
   * Pretty-print G and M codes with two digits (G1 -> G01, M3 -> M03)
   * @default true
   */
  prettyPrintCommands: boolean;

  /**
   * Pretty-print parameter numbers to always have at least one decimal point (X2 -> X2.0)
   * @default true
   */
  prettyPrintNumbers: boolean;

  /**
   * Indentation size (number of spaces per indent level)
   * Should be taken from VS Code's editor.tabSize setting
   * @default 4
   */
  indentSize: number;

  /**
   * Use tabs instead of spaces for indentation
   * Should be taken from VS Code's editor.insertSpaces setting (inverted)
   * @default false
   */
  useTabs: boolean;

  /**
   * Enable indentation for control structures (WHILE, IF, etc.)
   * When false, no indentation is applied
   * @default true
   */
  indent: boolean;

  /**
   * Compact output mode - removes all empty lines
   * @default false
   */
  compactOutput: boolean;

  /**
   * Add program delimiters (%) at the beginning and end of the program if not present
   * @default true
   */
  addProgramDelimiters: boolean;
}
