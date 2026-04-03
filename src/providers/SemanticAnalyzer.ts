/**
 * Semantic Analyzer Service
 *
 * Runs semantic analysis on a parsed AST to produce diagnostics
 * for modal state issues, unknown commands, and variable problems.
 *
 * Phase 1: AST walk via SemanticAnalysisVisitor (modal state + command validation)
 * Phase 2: Variable diagnostics from existing analysis data
 */
import { AstTraverser } from '../parser/AstTraverser';
import { DiagnosticCategory, ProgramNode } from '../parser/nodes';
import { AnalysisResults, VariableSymbol } from './AnalysisResults';
import { IDataProvider } from './IDataProvider';
import { formatVariableName } from './RenameUtils';
import { SemanticAnalysisVisitor } from './SemanticAnalysisVisitor';
import {
  SemanticDiagnostic,
  SemanticDiagnosticCode,
  SemanticDiagnosticTag,
} from './SemanticDiagnostic';

export class SemanticAnalyzer {
  /**
   * Analyze an AST and produce semantic diagnostics.
   *
   * @param program - The parsed AST
   * @param analysisResults - Results from basic analysis (for variable info)
   * @param dataProvider - Dialect-specific command database
   * @returns Array of semantic diagnostics
   */
  analyze(
    program: ProgramNode,
    analysisResults: AnalysisResults,
    dataProvider: IDataProvider
  ): readonly SemanticDiagnostic[] {
    // Phase 1: AST walk for modal state + command validation
    const visitor = new SemanticAnalysisVisitor(dataProvider);
    const traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);

    const diagnostics = [...visitor.getDiagnostics()];

    // Phase 2: Variable diagnostics from existing analysis data
    SemanticAnalyzer.analyzeVariables(analysisResults.variables, diagnostics);

    return diagnostics;
  }

  /**
   * Numeric variables at or above this threshold are controller system
   * variables (tool offsets, work coordinates, etc.) and should not be
   * flagged as "undefined".
   *
   * Note: this is a heuristic — actual system variable ranges differ
   * per dialect (e.g. Fanuc #1000+, LinuxCNC #5000+). Will be replaced
   * by user-configurable variable definitions (see issue #68).
   */
  private static readonly SYSTEM_VARIABLE_THRESHOLD = 1000;

  private static analyzeVariables(
    variables: Map<string | number, VariableSymbol>,
    diagnostics: SemanticDiagnostic[]
  ): void {
    for (const [, symbol] of variables) {
      // Skip system variables — controller-defined, never assigned in source
      if (
        typeof symbol.name === 'number' &&
        symbol.name >= SemanticAnalyzer.SYSTEM_VARIABLE_THRESHOLD
      ) {
        continue;
      }

      if (symbol.references.length > 0 && symbol.definitions.length === 0) {
        // Referenced but never assigned — use Hint (may be set externally)
        for (const ref of symbol.references) {
          diagnostics.push({
            range: ref.getRange(),
            message: `Variable '${formatVariableName(symbol.name)}' is used but never assigned in this file`,
            category: DiagnosticCategory.Hint,
            code: SemanticDiagnosticCode.UNDEFINED_VARIABLE,
          });
        }
      } else if (symbol.definitions.length > 0 && symbol.references.length === 0) {
        // Assigned but never referenced — Hint with Unnecessary tag (faded text)
        for (const def of symbol.definitions) {
          diagnostics.push({
            range: def.variableTokenRange,
            message: `Variable '${formatVariableName(symbol.name)}' is assigned but never used`,
            category: DiagnosticCategory.Hint,
            code: SemanticDiagnosticCode.UNUSED_VARIABLE,
            tags: [SemanticDiagnosticTag.Unnecessary],
          });
        }
      }
    }
  }
}
