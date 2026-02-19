/**
 * Hover Provider
 *
 * Provides intelligent hover tooltips for G-Code elements:
 * - Variables: Show value, declaration location, reference count
 * - G/M Commands: Show description, parameters, examples
 * - Operators: Show description and examples
 * - Functions: Show signature and description
 * - Axis Parameters: Show meaning
 */

import { TextDocument } from 'vscode-languageserver-textdocument';
import { Hover, MarkupKind, Position } from 'vscode-languageserver/node';

import { MarkdownBuilder } from './MarkdownBuilder';
import { DocumentationBuilder } from './DocumentationBuilder';
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
import { AnalysisResults } from './AnalysisResults';
import { DocumentState, GCodeSettings } from './DocumentStateManager';
import { ExpressionFormatter } from '../formatter/ExpressionFormatter';
import { formatVariableName } from './RenameUtils';
import { BaseProvider } from './BaseProvider';

/**
 * Hover Provider
 */
export class HoverProvider extends BaseProvider {
  private readonly documentationBuilder = new DocumentationBuilder();
  private readonly expressionFormatter = new ExpressionFormatter({
    prettyPrintNumbers: false,
    fallbackString: '(expression)',
  });

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
   * Generate hover content based on node type
   */
  private generateHoverContent(node: AstNode, state: DocumentState): string | null {
    if (node instanceof VariableAssignmentNode) {
      return this.generateVariableAssignmentHover(node);
    } else if (node instanceof VariableReferenceNode) {
      // Get analysis if we need variable information
      if (!state.analysis) {
        state.analysis = this.documentStateManager['analysisService'].analyze(state.ast);
      }
      return this.generateVariableReferenceHover(node, state.analysis);
    } else if (node instanceof MotionCommandNode) {
      return this.generateCommandHover(node, state);
    } else if (node instanceof BinaryExpressionNode) {
      return this.generateBinaryOperatorHover(node, state);
    } else if (node instanceof UnaryExpressionNode) {
      return this.generateUnaryOperatorHover(node, state);
    } else if (node instanceof FunctionCallNode) {
      return this.generateFunctionHover(node, state);
    } else if (node instanceof AxisParameterNode) {
      return this.generateAxisParameterHover(node, state);
    }

    return null;
  }

  /**
   * Generate hover for variable assignment
   */
  private generateVariableAssignmentHover(node: VariableAssignmentNode): string {
    const variableName = formatVariableName(node.name);
    const valueStr = this.expressionFormatter.format(node.value);
    const location = this.formatLocation(node.getRange());

    return new MarkdownBuilder()
      .labeledCode('Variable Declaration', variableName)
      .blank()
      .field('Value', valueStr, true)
      .blank()
      .field('Declared at', location)
      .build();
  }

  /**
   * Generate hover for variable reference
   */
  private generateVariableReferenceHover(
    node: VariableReferenceNode,
    analysis: AnalysisResults
  ): string {
    const variableName = formatVariableName(node.name);

    // Find declaration from the variables map
    const symbol = analysis.variables?.get(node.name);

    const builder = new MarkdownBuilder().labeledCode('Variable', variableName).blank();

    if (symbol && symbol.definitions.length > 0) {
      const declaration = symbol.definitions[0]; // Get first definition
      const valueStr = declaration.value
        ? this.expressionFormatter.format(declaration.value)
        : 'unknown';
      const declLocation = this.formatLocation(declaration.getRange());
      const refCount = symbol.references.length;

      return builder
        .field('Value', valueStr, true)
        .blank()
        .field('Declared at', declLocation)
        .blank()
        .field('References', `${refCount} usage(s)`)
        .build();
    }

    return builder.field('Status', 'Undeclared').build();
  }

  /**
   * Generate hover for G/M command
   */
  private generateCommandHover(node: MotionCommandNode, state: DocumentState): string | null {
    const dataProvider = this.getDataProvider(state.settings.dialect);
    const commandInfo = dataProvider.getCommandInfo(node.command);
    if (!commandInfo) {
      return null;
    }

    return this.documentationBuilder.buildCommandDocumentation(commandInfo).value;
  }

  /**
   * Generate hover for operator (binary or unary)
   */
  private generateOperatorHover(operator: string, state: DocumentState): string | null {
    const dataProvider = this.getDataProvider(state.settings.dialect);
    const operatorInfo = dataProvider.getOperatorInfo(operator);
    if (!operatorInfo) {
      return null;
    }

    return this.documentationBuilder.buildOperatorDocumentation(operatorInfo).value;
  }

  /**
   * Generate hover for binary operator
   */
  private generateBinaryOperatorHover(
    node: BinaryExpressionNode,
    state: DocumentState
  ): string | null {
    return this.generateOperatorHover(node.operator, state);
  }

  /**
    
   
  
   * Generate hover for unary operator
   */
  private generateUnaryOperatorHover(
    node: UnaryExpressionNode,
    state: DocumentState
  ): string | null {
    return this.generateOperatorHover(node.operator, state);
  }

  /**
   * Generate hover for function call
   */
  private generateFunctionHover(node: FunctionCallNode, state: DocumentState): string | null {
    const dataProvider = this.getDataProvider(state.settings.dialect);
    const functionInfo = dataProvider.getFunctionInfo(node.name);
    if (!functionInfo) {
      return null;
    }

    return this.documentationBuilder.buildFunctionDocumentation(functionInfo).value;
  }

  /**
   * Generate hover for axis parameter
   */
  private generateAxisParameterHover(node: AxisParameterNode, state: DocumentState): string | null {
    const dataProvider = this.getDataProvider(state.settings.dialect);
    const axisInfo = dataProvider.getAxisParameterInfo(node.axis);
    if (!axisInfo) {
      return null;
    }

    const valueStr = this.expressionFormatter.format(node.value);

    return this.documentationBuilder.buildParameterDocumentation(axisInfo, {
      additionalFields: [{ label: 'Value', value: valueStr, format: true }],
    }).value;
  }

  /**
   * Format a range as a human-readable location string
   */
  private formatLocation(range: Range): string {
    return `line ${range.start.line + 1}, column ${range.start.character}`;
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
