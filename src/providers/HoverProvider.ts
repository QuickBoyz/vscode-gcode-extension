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
import { DocumentState, DocumentStateManager, GCodeSettings } from './DocumentStateManager';
import { DataProvider } from './DataProvider';

/**
 * Hover Provider
 */
export class HoverProvider {
  private readonly dataProvider = new DataProvider();

  constructor(private readonly documentStateManager: DocumentStateManager) {}

  /**
   * Provide hover information for a position in the document
   */
  provideHover(document: TextDocument, position: Position, settings: GCodeSettings): Hover | null {
    const state = this.documentStateManager.getOrParseDocumentFromTextDocument(document, settings);

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
      return this.generateCommandHover(node);
    } else if (node instanceof BinaryExpressionNode) {
      return this.generateBinaryOperatorHover(node);
    } else if (node instanceof UnaryExpressionNode) {
      return this.generateUnaryOperatorHover(node);
    } else if (node instanceof FunctionCallNode) {
      return this.generateFunctionHover(node);
    } else if (node instanceof AxisParameterNode) {
      return this.generateAxisParameterHover(node);
    }

    return null;
  }

  /**
   * Generate hover for variable assignment
   */
  private generateVariableAssignmentHover(node: VariableAssignmentNode): string {
    const variableName = this.formatVariableName(node.name);
    const valueStr = this.formatExpressionForDisplay(node.value);
    const location = this.formatLocation(node.getRange());

    return new MarkdownBuilder()
      .labeledCode('Variable Declaration', variableName)
      .blank()
      .field('Value', valueStr)
      .blank()
      .field('Declared at', location, false)
      .build();
  }

  /**
   * Generate hover for variable reference
   */
  private generateVariableReferenceHover(
    node: VariableReferenceNode,
    analysis: AnalysisResults
  ): string {
    const variableName = this.formatVariableName(node.name);

    // Find declaration from the variables map
    const symbol = analysis.variables?.get(node.name);

    const builder = new MarkdownBuilder().labeledCode('Variable', variableName).blank();

    if (symbol && symbol.definitions.length > 0) {
      const declaration = symbol.definitions[0]; // Get first definition
      const valueStr = declaration.value
        ? this.formatExpressionForDisplay(declaration.value)
        : 'unknown';
      const declLocation = this.formatLocation(declaration.getRange());
      const refCount = symbol.references.length;

      return builder
        .field('Value', valueStr)
        .blank()
        .field('Declared at', declLocation, false)
        .blank()
        .field('References', `${refCount} usage(s)`, false)
        .build();
    }

    return builder.field('Status', 'Undeclared', false).build();
  }

  /**
   * Generate hover for info with title, description, category, and example
   * Used by commands, operators, and functions
   */
  private generateInfoHover(
    title: string,
    info: {
      description: string;
      category?: string;
      example?: string;
      group?: string;
      parameters?: string[];
    }
  ): string {
    const builder = new MarkdownBuilder().text(title).blank().text(info.description).blank();

    // Add category or group
    if (info.category) {
      builder.field('Category', info.category, false).blank();
    } else if (info.group) {
      builder.field('Group', info.group, false).blank();
    }

    // Add parameters for commands
    if (info.parameters && info.parameters.length > 0) {
      builder.field('Parameters', info.parameters.join(', '), false).blank();
    }

    // Add example
    if (info.example) {
      builder.text('**Example:**').codeBlock('gcode', info.example);
    }

    return builder.build();
  }

  /**
   * Generate hover for G/M command
   */
  private generateCommandHover(node: MotionCommandNode): string | null {
    const commandInfo = this.dataProvider.getCommandInfo(node.command);
    if (!commandInfo) {
      return null;
    }

    const title = `**${commandInfo.name}** (\`${commandInfo.command}\`)`;
    return this.generateInfoHover(title, commandInfo);
  }

  /**
   * Generate hover for operator (binary or unary)
   */
  private generateOperatorHover(operator: string): string | null {
    const operatorInfo = this.dataProvider.getOperatorInfo(operator);
    if (!operatorInfo) {
      return null;
    }

    const title = `**${operatorInfo.name}** (\`${operatorInfo.operator}\`)`;
    return this.generateInfoHover(title, operatorInfo);
  }

  /**
   * Generate hover for binary operator
   */
  private generateBinaryOperatorHover(node: BinaryExpressionNode): string | null {
    return this.generateOperatorHover(node.operator);
  }

  /**
   * Generate hover for unary operator
   */
  private generateUnaryOperatorHover(node: UnaryExpressionNode): string | null {
    return this.generateOperatorHover(node.operator);
  }

  /**
   * Generate hover for function call
   */
  private generateFunctionHover(node: FunctionCallNode): string | null {
    const functionInfo = this.dataProvider.getFunctionInfo(node.name);
    if (!functionInfo) {
      return null;
    }

    const title = `**Function:** \`${functionInfo.signature}\``;
    return this.generateInfoHover(title, functionInfo);
  }

  /**
   * Generate hover for axis parameter
   */
  private generateAxisParameterHover(node: AxisParameterNode): string | null {
    const axisInfo = this.dataProvider.getAxisParameterInfo(node.axis);
    if (!axisInfo) {
      return null;
    }

    const valueStr = this.formatExpressionForDisplay(node.value);
    const title = `**${axisInfo.name}** (\`${axisInfo.axis}\`)`;

    return new MarkdownBuilder()
      .text(title)
      .blank()
      .text(axisInfo.description)
      .blank()
      .field('Value', valueStr)
      .addIf(!!axisInfo.units, (b) => {
        if (axisInfo.units) {
          b.blank().field('Units', axisInfo.units, false);
        }
      })
      .build();
  }

  /**
   * Format a range as a human-readable location string
   */
  private formatLocation(range: Range): string {
    return `line ${range.start.line + 1}, column ${range.start.character}`;
  }

  /**
   * Format variable name for display
   */
  private formatVariableName(name: string | number): string {
    if (typeof name === 'number') {
      return `#${name}`;
    }
    return `#<${name}>`;
  }

  /**
   * Format expression for display (simplified string representation)
   */
  private formatExpressionForDisplay(node: AstNode): string {
    // This is a simplified formatter for hover display
    // In a real implementation, you might want to use a visitor pattern
    if (node instanceof VariableReferenceNode) {
      return this.formatVariableName(node.name);
    } else if (node instanceof BinaryExpressionNode) {
      return `${this.formatExpressionForDisplay(node.left)} ${node.operator} ${this.formatExpressionForDisplay(node.right)}`;
    } else if (node instanceof UnaryExpressionNode) {
      return `${node.operator}${this.formatExpressionForDisplay(node.operand)}`;
    } else if (node instanceof FunctionCallNode) {
      return `${node.name}[${this.formatExpressionForDisplay(node.argument)}]`;
    } else if ('value' in node) {
      return String(node.value);
    }

    return '(expression)';
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
