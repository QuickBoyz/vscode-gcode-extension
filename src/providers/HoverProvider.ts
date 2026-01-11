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

import {
  AstNode,
  AxisParameterNode,
  BinaryExpressionNode,
  FunctionCallNode,
  IfStatementNode,
  LiteralExpressionNode,
  MotionCommandNode,
  ProgramNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  VariableReferenceNode,
  WhileStatementNode,
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
    const node = this.findBestNodeAtPosition(state.ast, position);
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
   * Find the best (smallest) node at the given position
   * Uses the same logic as RenameProvider for consistency
   * Prioritizes operator ranges for binary/unary expression nodes
   */
  private findBestNodeAtPosition(rootNode: ProgramNode, position: Position): AstNode | null {
    let bestMatch: AstNode | null = null;
    let smallestSize = Infinity;

    const checkNode = (node: AstNode) => {
      const range = node.getRange();
      if (Range.isPositionInRange(position, range)) {
        const size = this.calculateNodeSize(range);
        if (size < smallestSize) {
          smallestSize = size;
          bestMatch = node;
        }
      }

      // Check children
      if (node instanceof VariableAssignmentNode) {
        checkNode(node.value);
      } else if (node instanceof BinaryExpressionNode) {
        // Check if position is specifically on the operator token
        if (node.operatorRange && Range.isPositionInRange(position, node.operatorRange)) {
          const opSize = this.calculateNodeSize(node.operatorRange);
          if (opSize < smallestSize) {
            smallestSize = opSize;
            bestMatch = node;
            return; // Operator range is the best match, no need to check children
          }
        }
        checkNode(node.left);
        checkNode(node.right);
      } else if (node instanceof UnaryExpressionNode) {
        // Check if position is specifically on the operator token
        if (node.operatorRange && Range.isPositionInRange(position, node.operatorRange)) {
          const opSize = this.calculateNodeSize(node.operatorRange);
          if (opSize < smallestSize) {
            smallestSize = opSize;
            bestMatch = node;
            return; // Operator range is the best match, no need to check children
          }
        }
        checkNode(node.operand);
      } else if (node instanceof FunctionCallNode) {
        checkNode(node.argument);
      } else if (node instanceof MotionCommandNode) {
        for (const param of node.getParameters()) {
          checkNode(param);
          if (param instanceof AxisParameterNode) {
            checkNode(param.value);
          }
        }
      } else if (node instanceof IfStatementNode) {
        // Check condition in IF clause
        checkNode(node.ifClause.condition);
        // Check body
        for (const stmt of node.ifClause.body) {
          checkNode(stmt);
        }
        // Check ELSEIF clauses
        if (node.elseIfClauses) {
          for (const elseif of node.elseIfClauses) {
            checkNode(elseif.condition);
            for (const stmt of elseif.body) {
              checkNode(stmt);
            }
          }
        }
        // Check ELSE clause
        if (node.elseClause) {
          for (const stmt of node.elseClause.body) {
            checkNode(stmt);
          }
        }
      } else if (node instanceof WhileStatementNode) {
        // Check condition
        checkNode(node.condition);
        // Check body
        for (const stmt of node.body) {
          checkNode(stmt);
        }
      } else if (node instanceof LiteralExpressionNode) {
        // Literal nodes are leaf nodes, already checked above
      }
    };

    // Check all statements in the program
    for (const stmt of rootNode.statements) {
      checkNode(stmt);
    }

    return bestMatch;
  }

  /**
   * Calculate size of a range (for finding smallest enclosing node)
   */
  private calculateNodeSize(range: Range): number {
    const lines = range.end.line - range.start.line;
    const chars = lines === 0 ? range.end.character - range.start.character : range.end.character;
    return lines * 1000 + chars; // Weight lines more heavily
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
    const location = `line ${node.getRange().start.line + 1}, column ${node.getRange().start.character}`;

    return [
      `**Variable Declaration:** \`${variableName}\``,
      '',
      `**Value:** \`${valueStr}\``,
      '',
      `**Declared at:** ${location}`,
    ].join('\n');
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

    if (symbol && symbol.definitions.length > 0) {
      const declaration = symbol.definitions[0]; // Get first definition
      const valueStr = declaration.value
        ? this.formatExpressionForDisplay(declaration.value)
        : 'unknown';
      const declLocation = `line ${declaration.getRange().start.line + 1}, column ${declaration.getRange().start.character}`;
      const refCount = symbol.references.length;

      return [
        `**Variable:** \`${variableName}\``,
        '',
        `**Value:** \`${valueStr}\``,
        '',
        `**Declared at:** ${declLocation}`,
        '',
        `**References:** ${refCount} usage(s)`,
      ].join('\n');
    }

    return [`**Variable:** \`${variableName}\``, '', `**Status:** Undeclared`].join('\n');
  }

  /**
   * Generate hover for G/M command
   */
  private generateCommandHover(node: MotionCommandNode): string | null {
    const commandInfo = this.dataProvider.getCommandInfo(node.command);
    if (!commandInfo) {
      return null;
    }

    const parts = [
      `**${commandInfo.name}** (\`${commandInfo.command}\`)`,
      '',
      commandInfo.description,
    ];

    if (commandInfo.group) {
      parts.push('', `**Group:** ${commandInfo.group}`);
    }

    if (commandInfo.parameters && commandInfo.parameters.length > 0) {
      parts.push('', `**Parameters:** ${commandInfo.parameters.join(', ')}`);
    }

    if (commandInfo.example) {
      parts.push('', `**Example:**`, '```gcode', commandInfo.example, '```');
    }

    return parts.join('\n');
  }

  /**
   * Generate hover for binary operator
   */
  private generateBinaryOperatorHover(node: BinaryExpressionNode): string | null {
    const operatorInfo = this.dataProvider.getOperatorInfo(node.operator);
    if (!operatorInfo) {
      return null;
    }

    return [
      `**${operatorInfo.name}** (\`${operatorInfo.operator}\`)`,
      '',
      operatorInfo.description,
      '',
      `**Category:** ${operatorInfo.category}`,
      '',
      `**Example:**`,
      '```gcode',
      operatorInfo.example,
      '```',
    ].join('\n');
  }

  /**
   * Generate hover for unary operator
   */
  private generateUnaryOperatorHover(node: UnaryExpressionNode): string | null {
    const operatorInfo = this.dataProvider.getOperatorInfo(node.operator);
    if (!operatorInfo) {
      return null;
    }

    return [
      `**${operatorInfo.name}** (\`${operatorInfo.operator}\`)`,
      '',
      operatorInfo.description,
      '',
      `**Category:** ${operatorInfo.category}`,
      '',
      `**Example:**`,
      '```gcode',
      operatorInfo.example,
      '```',
    ].join('\n');
  }

  /**
   * Generate hover for function call
   */
  private generateFunctionHover(node: FunctionCallNode): string | null {
    const functionInfo = this.dataProvider.getFunctionInfo(node.name);
    if (!functionInfo) {
      return null;
    }

    return [
      `**Function:** \`${functionInfo.signature}\``,
      '',
      functionInfo.description,
      '',
      `**Category:** ${functionInfo.category}`,
      '',
      `**Example:**`,
      '```gcode',
      functionInfo.example,
      '```',
    ].join('\n');
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

    return [
      `**${axisInfo.name}** (\`${axisInfo.axis}\`)`,
      '',
      axisInfo.description,
      '',
      `**Value:** \`${valueStr}\``,
      '',
      axisInfo.units ? `**Units:** ${axisInfo.units}` : '',
    ]
      .filter(Boolean)
      .join('\n');
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
