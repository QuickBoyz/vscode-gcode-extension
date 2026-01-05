import {
  AxisParameterNode,
  BinaryExpressionNode,
  BlockStatementNode,
  CommentNode,
  ErrorNode,
  ExpressionNode,
  FunctionCallNode,
  ElseClauseNode,
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
} from "./nodes";

export abstract class AstVisitor<T> {
  abstract visitVariableAssignment(node: VariableAssignmentNode): T;
  abstract visitFunctionCall(node: FunctionCallNode): T;
  abstract visitWhileStatement(node: WhileStatementNode): T;
  abstract visitWhileStatementEnd(node: WhileStatementNode): T;
  abstract visitIfStatement(node: IfStatementNode): T;
  abstract visitIfClause(node: IfClauseNode): T;
  abstract visitElseClause(node: ElseClauseNode): T;
  abstract visitIfStatementEnd(node: IfStatementNode): T;
  abstract visitBlockStatement(node: BlockStatementNode): T;
  abstract visitExpression(node: ExpressionNode): T;
  abstract visitStatement(node: StatementNode): T;
  abstract visitProgram(node: ProgramNode): T;
  abstract visitVariableReference(node: VariableReferenceNode): T;
  abstract visitBinaryExpression(node: BinaryExpressionNode): T;
  abstract visitUnaryExpression(node: UnaryExpressionNode): T;
  abstract visitLiteralExpression(node: LiteralExpressionNode): T;
  abstract visitAxisParameter(node: AxisParameterNode): T;
  abstract visitMotionCommand(node: MotionCommandNode): T;
  abstract visitComment(node: CommentNode): T;
  abstract visitError(node: ErrorNode): T;
}
