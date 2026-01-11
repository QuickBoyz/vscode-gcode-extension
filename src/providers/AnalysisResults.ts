import { ErrorNode, VariableAssignmentNode, VariableReferenceNode } from '../parser/nodes';

/**
 * Symbol information for a variable
 */
export interface VariableSymbol {
  name: string | number;
  /** All definitions (assignments) of this variable */
  definitions: VariableAssignmentNode[];
  /** All references (uses) of this variable */
  references: VariableReferenceNode[];
}

/**
 * Results from AST analysis
 */
export interface AnalysisResults {
  /** Variable symbols (definitions + references) */
  variables: Map<string | number, VariableSymbol>;

  /** Syntax errors found in the AST */
  errors: ErrorNode[];

  /** Semantic tokens for syntax highlighting */
  tokens?: {
    data: number[];
    resultId?: string;
  };
}

/**
 * Options for AST analysis
 */
export interface AnalysisOptions {
  /** Include semantic tokens (expensive) */
  includeTokens?: boolean;
}
