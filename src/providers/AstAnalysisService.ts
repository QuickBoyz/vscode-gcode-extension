import { AstTraverser } from '../parser/AstTraverser';
import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import {
  AxisParameterNode,
  CommentNode,
  ErrorNode,
  FunctionCallNode,
  IfStatementNode,
  LiteralExpressionNode,
  MotionCommandNode,
  ProgramNode,
  VariableAssignmentNode,
  VariableReferenceNode,
  WhileStatementNode,
} from '../parser/nodes';
import { GCodeSemanticTokensBuilder } from './SemanticTokensBuilder';
import { AnalysisOptions, AnalysisResults, VariableSymbol } from './AnalysisResults';
import { SEMANTIC_TOKENS_LEGEND, SemanticTokenTypes } from './SemanticTokensProvider';

/**
 * Unified AST analysis visitor that collects:
 * - Variables (definitions + references)
 * - Syntax errors
 * - Semantic tokens (optional)
 */
class UnifiedAnalysisVisitor extends BaseAstVisitor<void> {
  private variables = new Map<string | number, VariableSymbol>();
  private errors: ErrorNode[] = [];
  private tokensBuilder?: GCodeSemanticTokensBuilder;

  constructor(includeTokens: boolean = false) {
    super();
    if (includeTokens) {
      this.tokensBuilder = new GCodeSemanticTokensBuilder();
    }
  }

  protected defaultValue(): void {
    // No-op default
  }

  visitVariableAssignment(node: VariableAssignmentNode): void {
    let symbol = this.variables.get(node.name);
    if (!symbol) {
      symbol = { name: node.name, definitions: [], references: [] };
      this.variables.set(node.name, symbol);
    }
    symbol.definitions.push(node);

    // Add semantic token if enabled
    if (this.tokensBuilder && node.variableTokenRange) {
      this.tokensBuilder.pushRange(
        node.variableTokenRange,
        this.getTokenTypeIndex(SemanticTokenTypes.Variable)
      );
    }
  }

  visitVariableReference(node: VariableReferenceNode): void {
    let symbol = this.variables.get(node.name);
    if (!symbol) {
      symbol = { name: node.name, definitions: [], references: [] };
      this.variables.set(node.name, symbol);
    }
    symbol.references.push(node);

    // Add semantic token if enabled
    if (this.tokensBuilder) {
      this.tokensBuilder.pushRange(
        node.getRange(),
        this.getTokenTypeIndex(SemanticTokenTypes.Variable)
      );
    }
  }

  visitError(node: ErrorNode): void {
    this.errors.push(node);
  }

  // Semantic token visits
  visitMotionCommand(node: MotionCommandNode): void {
    if (this.tokensBuilder) {
      this.tokensBuilder.pushRange(
        node.getRange(),
        this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
      );
    }
  }

  visitComment(node: CommentNode): void {
    if (this.tokensBuilder) {
      this.tokensBuilder.pushRange(
        node.getRange(),
        this.getTokenTypeIndex(SemanticTokenTypes.Comment)
      );
    }
  }

  visitFunctionCall(node: FunctionCallNode): void {
    if (this.tokensBuilder) {
      this.tokensBuilder.pushRange(
        node.funcTokenRange,
        this.getTokenTypeIndex(SemanticTokenTypes.Function)
      );
    }
  }

  visitIfStatement(node: IfStatementNode): void {
    if (this.tokensBuilder) {
      // Add IF keyword token
      this.tokensBuilder.pushRange(
        node.ifClause.keywordTokenRange,
        this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
      );

      // Add THEN token if present
      if (node.ifClause.thenTokenRange) {
        this.tokensBuilder.pushRange(
          node.ifClause.thenTokenRange,
          this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
        );
      }

      // Add semantic tokens for ELSEIF and THEN in elseIfClauses
      if (node.elseIfClauses) {
        for (const elseifClause of node.elseIfClauses) {
          // Add ELSEIF keyword token
          this.tokensBuilder.pushRange(
            elseifClause.keywordTokenRange,
            this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
          );

          // Add THEN token if present
          if (elseifClause.thenTokenRange) {
            this.tokensBuilder.pushRange(
              elseifClause.thenTokenRange,
              this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
            );
          }
        }
      }

      // Add ELSE keyword token if present
      if (node.elseClause) {
        this.tokensBuilder.pushRange(
          node.elseClause.keywordTokenRange,
          this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
        );
      }
    }
  }

  visitIfStatementEnd(node: IfStatementNode): void {
    if (this.tokensBuilder) {
      this.tokensBuilder.pushRange(
        node.endIfTokenRange,
        this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
      );
    }
  }

  visitWhileStatement(node: WhileStatementNode): void {
    if (this.tokensBuilder) {
      this.tokensBuilder.pushRange(
        node.whileTokenRange,
        this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
      );

      if (node.doTokenRange) {
        this.tokensBuilder.pushRange(
          node.doTokenRange,
          this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
        );
      }
    }
  }

  visitWhileStatementEnd(node: WhileStatementNode): void {
    if (this.tokensBuilder) {
      this.tokensBuilder.pushRange(
        node.endWhileTokenRange,
        this.getTokenTypeIndex(SemanticTokenTypes.Keyword)
      );
    }
  }

  visitLiteralExpression(node: LiteralExpressionNode): void {
    if (this.tokensBuilder) {
      this.tokensBuilder.pushRange(
        node.getRange(),
        this.getTokenTypeIndex(SemanticTokenTypes.Number)
      );
    }
  }

  visitAxisParameter(node: AxisParameterNode): void {
    if (this.tokensBuilder) {
      this.tokensBuilder.pushRange(
        node.getRange(),
        this.getTokenTypeIndex(SemanticTokenTypes.Parameter)
      );
    }
  }

  getResults(): AnalysisResults {
    return {
      variables: this.variables,
      errors: this.errors,
      tokens: this.tokensBuilder ? { data: this.tokensBuilder.build().data } : undefined,
    };
  }

  private getTokenTypeIndex(tokenType: string): number {
    return SEMANTIC_TOKENS_LEGEND.tokenTypes.indexOf(tokenType);
  }
}

/**
 * Service for analyzing G-Code AST
 */
export class AstAnalysisService {
  /**
   * Analyze an AST and return collected results
   */
  analyze(program: ProgramNode, options: AnalysisOptions = {}): AnalysisResults {
    const visitor = new UnifiedAnalysisVisitor(options.includeTokens ?? false);
    const traverser = new AstTraverser(visitor);
    traverser.traverseProgram(program);
    return visitor.getResults();
  }
}
