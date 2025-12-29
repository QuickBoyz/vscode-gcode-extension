/**
 * Formatter configuration options
 */
export interface FormatterOptions {
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
   * Preserve empty lines in the output
   * When true, consecutive empty lines are collapsed to a single empty line
   * When false, all empty lines are removed
   * @default true
   */
  preserveEmptyLines: boolean;

  /**
   * Compact output mode - removes all empty lines
   * Takes precedence over preserveEmptyLines when true
   * @default false
   */
  compactOutput: boolean;
}

/**
 * Default formatter options
 */
export const defaultFormatterOptions: FormatterOptions = {
  addLineNumbers: false,
  lineNumberStart: 10,
  lineNumberIncrement: 10,
  prettyPrintCommands: true,
  prettyPrintNumbers: true,
  indentSize: 4,
  useTabs: false,
  indent: true,
  preserveEmptyLines: true,
  compactOutput: false,
};
