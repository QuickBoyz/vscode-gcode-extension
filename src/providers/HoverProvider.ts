/**
 * Hover Provider
 *
 * Provides intelligent hover tooltips for G-Code elements:
 * - Variables: Show value, declaration location, reference count
 * - G/M Commands: Show description, parameters, examples
 * - Operators: Show description and examples
 * - Functions: Show signature and description
 * - Axis Parameters: Show meaning
 *
 * Uses a strategy pattern to dispatch hover generation by AST node type.
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';

import { NodeFinder } from './NodeFinder';
import {
  AstNode,
  AxisParameterNode,
  BinaryExpressionNode,
  FunctionCallNode,
  MotionCommandNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  VariableReferenceNode,
} from '../parser/nodes';
import { Range } from '../parser/nodes/Range';
import { ExpressionFormatter } from '../formatter/ExpressionFormatter';
import { AnalysisResults } from './AnalysisResults';
import { DocumentationBuilder } from './DocumentationBuilder';
import { DocumentState, GCodeSettings } from './DocumentStateManager';
import { BaseProvider } from './BaseProvider';
import {
  HoverStrategy,
  BinaryExpressionHoverStrategy,
  CommandHoverStrategy,
  FunctionHoverStrategy,
  ParameterHoverStrategy,
  UnaryExpressionHoverStrategy,
  VariableHoverStrategy,
} from './hover';

/**
 * Constructor type for AstNode subclasses, used as strategy map keys.
 * Uses a broad signature because concrete node constructors have varying parameter lists;
 * the map is only used for identity-based lookup via `node.constructor`.
 */
type AstNodeConstructor = new (...args: never[]) => AstNode;

/**
 * Hover Provider
 *
 * Delegates hover content generation to node-type-specific strategies
 * via a constructor-keyed map, eliminating instanceof dispatch chains.
 */
export class HoverProvider extends BaseProvider {
  /**
   * Map from AST node constructor to the strategy that handles it.
   * Order does not matter — lookup is by exact constructor match.
   */
  private readonly strategies: ReadonlyMap<AstNodeConstructor, HoverStrategy>;

  constructor(...args: ConstructorParameters<typeof BaseProvider>) {
    super(...args);

    const documentationBuilder = new DocumentationBuilder();
    const expressionFormatter = new ExpressionFormatter({
      prettyPrintNumbers: false,
      fallbackString: '(expression)',
    });

    const commandStrategy = new CommandHoverStrategy(documentationBuilder);
    const variableStrategy = new VariableHoverStrategy(expressionFormatter);
    const binaryExpressionStrategy = new BinaryExpressionHoverStrategy(documentationBuilder);
    const unaryExpressionStrategy = new UnaryExpressionHoverStrategy(documentationBuilder);
    const functionStrategy = new FunctionHoverStrategy(documentationBuilder);
    const parameterStrategy = new ParameterHoverStrategy(documentationBuilder, expressionFormatter);

    this.strategies = new Map<AstNodeConstructor, HoverStrategy>([
      [MotionCommandNode, commandStrategy],
      [VariableAssignmentNode, variableStrategy],
      [VariableReferenceNode, variableStrategy],
      [BinaryExpressionNode, binaryExpressionStrategy],
      [UnaryExpressionNode, unaryExpressionStrategy],
      [FunctionCallNode, functionStrategy],
      [AxisParameterNode, parameterStrategy],
    ]);
  }

  /**
   * Provide hover information for a position in the document
   */
  provideHover(document: TextDocument, position: Position, settings: GCodeSettings): Hover | null {
    const state = this.getDocumentState(document, settings);

    // Find the best matching node at the position
    const node = NodeFinder.findBestNodeAtPosition(state.ast, position);
    if (!node) {
      return null;
    }

    // Generate hover content based on node type
    const content = this.generateHoverContent(node, state);
    if (!content) {
      return null;
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: content,
      },
      range: this.convertRange(node.getRange()),
    };
  }

  /**
   * Generate hover content by delegating to the appropriate strategy
   */
  private generateHoverContent(node: AstNode, state: DocumentState): string | null {
    const strategy = this.strategies.get(node.constructor as AstNodeConstructor);
    if (!strategy) {
      return null;
    }

    const dataProvider = this.getDataProvider(state.settings.dialect);

    // Only compute analysis for strategies that need it (variable nodes)
    let analysis: AnalysisResults | undefined;
    if (node instanceof VariableAssignmentNode || node instanceof VariableReferenceNode) {
      if (!state.analysis) {
        state.analysis = this.documentStateManager.analyzeAst(state.ast);
      }
      analysis = state.analysis;
    }

    return strategy.generateHover(node, dataProvider, analysis);
  }

  /**
   * Convert parser Range to LSP Range
   */
  private convertRange(range: Range): {
    start: { line: number; character: number };
    end: { line: number; character: number };
  } {
    return {
      start: { line: range.start.line, character: range.start.character },
      end: { line: range.end.line, character: range.end.character },
    };
  }
}
