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
