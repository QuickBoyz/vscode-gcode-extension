/**
 * Position Shift Visitor
 *
 * Shifts the range of every AST node by a line delta.
 * Used by IncrementalParsingService to fix positions of statements
 * that follow an edited region after incremental re-parsing.
 */
import { BaseAstVisitor } from './BaseAstVisitor';
import {
  AstNode,
  AxisParameterNode,
  BinaryExpressionNode,
  CommentNode,
  ElseClauseNode,
  ErrorNode,
  ExpressionNode,
  FunctionCallNode,
  IfClauseNode,
  IfStatementNode,
  LineNumberNode,
  LiteralExpressionNode,
  MotionCommandNode,
  ProgramNode,
  Range,
  ReturnStatementNode,
  StatementNode,
  SubroutineCallNode,
  SubroutineDefinitionNode,
  SubroutineLabelNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  VariableReferenceNode,
  WhileStatementNode,
} from './nodes';

export class PositionShiftVisitor extends BaseAstVisitor<void> {
  constructor(private lineDelta: number) {
    super();
  }

  protected defaultValue(): void {
    return;
  }

  private shiftNode(node: AstNode): void {
    const range = node.getRange();
    node.setRange(
      Range.create(
        range.start.line + this.lineDelta,
        range.start.character,
        range.end.line + this.lineDelta,
        range.end.character
      )
    );
  }

  visitProgram(_node: ProgramNode): void {
    // ProgramNode does not extend AstNode and has no range to shift.
    // Its child statements are visited individually by the traverser.
  }

  visitVariableAssignment(node: VariableAssignmentNode): void {
    this.shiftNode(node);
  }

  visitFunctionCall(node: FunctionCallNode): void {
    this.shiftNode(node);
  }

  visitWhileStatement(node: WhileStatementNode): void {
    this.shiftNode(node);
  }

  visitIfStatement(node: IfStatementNode): void {
    this.shiftNode(node);
  }

  visitIfClause(node: IfClauseNode): void {
    this.shiftNode(node);
  }

  visitElseClause(node: ElseClauseNode): void {
    this.shiftNode(node);
  }

  visitExpression(node: ExpressionNode): void {
    this.shiftNode(node);
  }

  visitVariableReference(node: VariableReferenceNode): void {
    this.shiftNode(node);
  }

  visitBinaryExpression(node: BinaryExpressionNode): void {
    this.shiftNode(node);
  }

  visitUnaryExpression(node: UnaryExpressionNode): void {
    this.shiftNode(node);
  }

  visitLiteralExpression(node: LiteralExpressionNode): void {
    this.shiftNode(node);
  }

  visitAxisParameter(node: AxisParameterNode): void {
    this.shiftNode(node);
  }

  visitMotionCommand(node: MotionCommandNode): void {
    this.shiftNode(node);
  }

  visitComment(node: CommentNode): void {
    this.shiftNode(node);
  }

  visitError(node: ErrorNode): void {
    this.shiftNode(node);
  }

  visitLineNumber(node: LineNumberNode): void {
    this.shiftNode(node);
  }

  visitSubroutineLabel(node: SubroutineLabelNode): void {
    this.shiftNode(node);
  }

  visitSubroutineDefinition(node: SubroutineDefinitionNode): void {
    this.shiftNode(node);
  }

  visitSubroutineCall(node: SubroutineCallNode): void {
    this.shiftNode(node);
  }

  visitReturnStatement(node: ReturnStatementNode): void {
    this.shiftNode(node);
  }

  visitStatement(node: StatementNode): void {
    this.shiftNode(node);
  }
}
