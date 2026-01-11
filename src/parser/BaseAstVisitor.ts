import { AstVisitor } from './AstVisitor';
import {
  AxisParameterNode,
  BinaryExpressionNode,
  BlockStatementNode,
  CommentNode,
  ElseClauseNode,
  ErrorNode,
  ExpressionNode,
  FunctionCallNode,
  IfClauseNode,
  IfStatementNode,
  LiteralExpressionNode,
  MotionCommandNode,
  ProgramNode,
  StatementNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  VariableReferenceNode,
  WhileStatementNode,
} from './nodes';

/**
 * Base visitor with no-op default implementations.
 * Subclasses only need to override methods they care about.
 *
 * This eliminates 60-90% boilerplate from specialized visitors
 * that only need to handle a few specific node types.
 */
export abstract class BaseAstVisitor<T> implements AstVisitor<T> {
  /**
   * Default return value for unimplemented visit methods.
   * Subclasses must implement this.
   */
  protected abstract defaultValue(): T;

  visitProgram(_node: ProgramNode): T {
    return this.defaultValue();
  }

  visitStatement(_node: StatementNode): T {
    return this.defaultValue();
  }

  visitVariableAssignment(_node: VariableAssignmentNode): T {
    return this.defaultValue();
  }

  visitFunctionCall(_node: FunctionCallNode): T {
    return this.defaultValue();
  }

  visitWhileStatement(_node: WhileStatementNode): T {
    return this.defaultValue();
  }

  visitWhileStatementEnd(_node: WhileStatementNode): T {
    return this.defaultValue();
  }

  visitIfStatement(_node: IfStatementNode): T {
    return this.defaultValue();
  }

  visitIfClause(_node: IfClauseNode): T {
    return this.defaultValue();
  }

  visitElseClause(_node: ElseClauseNode): T {
    return this.defaultValue();
  }

  visitIfStatementEnd(_node: IfStatementNode): T {
    return this.defaultValue();
  }

  visitBlockStatement(_node: BlockStatementNode): T {
    return this.defaultValue();
  }

  visitExpression(_node: ExpressionNode): T {
    return this.defaultValue();
  }

  visitVariableReference(_node: VariableReferenceNode): T {
    return this.defaultValue();
  }

  visitBinaryExpression(_node: BinaryExpressionNode): T {
    return this.defaultValue();
  }

  visitUnaryExpression(_node: UnaryExpressionNode): T {
    return this.defaultValue();
  }

  visitLiteralExpression(_node: LiteralExpressionNode): T {
    return this.defaultValue();
  }

  visitAxisParameter(_node: AxisParameterNode): T {
    return this.defaultValue();
  }

  visitMotionCommand(_node: MotionCommandNode): T {
    return this.defaultValue();
  }

  visitComment(_node: CommentNode): T {
    return this.defaultValue();
  }

  visitError(_node: ErrorNode): T {
    return this.defaultValue();
  }
}
