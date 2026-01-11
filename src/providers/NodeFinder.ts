/**
 * AST Node Finder Utility
 *
 * Shared utility for finding the best (smallest) AST node at a given position.
 * Used by HoverProvider, RenameProvider, DocumentHighlightProvider, etc.
 */

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
  WhileStatementNode,
} from '../parser/nodes';
import { Position, Range } from '../parser/nodes';

/**
 * AST Node Finder
 *
 * Utility class for finding AST nodes at specific positions in the source code.
 * Provides methods for range size calculation and node finding with operator prioritization.
 */
export class NodeFinder {
  /**
   * Weight multiplier for line difference in range size calculation.
   * Ensures multi-line ranges are always larger than single-line ranges.
   */
  public static readonly RANGE_SIZE_LINE_WEIGHT = 1000;

  /**
   * Calculate size of a range (for finding smallest enclosing node)
   * Formula: (lines * LINE_WEIGHT) + characters
   *
   * @param range - The range to calculate size for
   * @returns The calculated size of the range
   */
  public static calculateRangeSize(range: Range): number {
    const lines = range.end.line - range.start.line;
    const chars = lines === 0 ? range.end.character - range.start.character : range.end.character;
    return lines * NodeFinder.RANGE_SIZE_LINE_WEIGHT + chars;
  }

  /**
   * Find the best (smallest) node at the given position
   * Prioritizes operator ranges for binary/unary expression nodes
   *
   * @param rootNode - The program AST root
   * @param position - The position to search for
   * @returns The smallest AST node containing the position, or null if none found
   */
  public static findBestNodeAtPosition(rootNode: ProgramNode, position: Position): AstNode | null {
    let bestMatch: AstNode | null = null;
    let smallestSize = Infinity;

    /**
     * Check if position is on operator range and update best match if smaller
     * @returns true if operator range is the best match (stops further traversal)
     */
    const checkOperatorRange = (node: BinaryExpressionNode | UnaryExpressionNode): boolean => {
      if (node.operatorRange && Range.isPositionInRange(position, node.operatorRange)) {
        const opSize = NodeFinder.calculateRangeSize(node.operatorRange);
        if (opSize < smallestSize) {
          smallestSize = opSize;
          bestMatch = node;
          return true; // Operator range is the best match, no need to check children
        }
      }
      return false;
    };

    const checkNode = (node: AstNode) => {
      const range = node.getRange();
      if (Range.isPositionInRange(position, range)) {
        const size = NodeFinder.calculateRangeSize(range);
        if (size < smallestSize) {
          smallestSize = size;
          bestMatch = node;
        }
      }

      // Check children
      if (node instanceof VariableAssignmentNode) {
        checkNode(node.value);
      } else if (node instanceof BinaryExpressionNode) {
        if (checkOperatorRange(node)) return;
        checkNode(node.left);
        checkNode(node.right);
      } else if (node instanceof UnaryExpressionNode) {
        if (checkOperatorRange(node)) return;
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
}
