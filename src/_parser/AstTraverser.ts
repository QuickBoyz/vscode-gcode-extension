// ast/AstTraverser.ts
import { AstVisitor } from "./AstVisitor";
import {
  ProgramNode,
  StatementNode,
  ExpressionNode,
  VariableAssignmentNode,
  WhileStatementNode,
  FunctionCallNode,
  MotionCommandNode,
  AxisParameterNode,
  CommentNode,
  ErrorNode,
  IfStatementNode,
  IfClauseNode,
  ElseClauseNode,
} from "./nodes";

export class AstTraverser<T = void> {
  constructor(private visitor: AstVisitor<T>) {}

  traverseProgram(node: ProgramNode): T {
    const result = this.visitor.visitProgram(node);
    this.traverseStatements(node.statements);
    return result;
  }

  private traverseStatements(
    statements: readonly StatementNode[]
  ): void {
    for (const stmt of statements) {
      this.traverseStatement(stmt);
    }
  }

  private traverseStatement(node: StatementNode): void {
    switch (true) {
      case node instanceof VariableAssignmentNode:
        this.traverseVariableAssignment(node);
        break;
      case node instanceof WhileStatementNode:
        this.traverseWhileStatement(node);
        break;
      case node instanceof IfStatementNode:
        this.traverseIfStatement(node);
        break;
      case node instanceof MotionCommandNode:
        this.traverseMotionCommand(node);
        break;
      case node instanceof AxisParameterNode:
        this.traverseAxisParameter(node);
        break;
      case node instanceof CommentNode:
        this.visitor.visitComment(node);
        break;
      case node instanceof ErrorNode:
        this.visitor.visitError(node);
        break;
      default:
        if (this.visitor.visitStatement)
          this.visitor.visitStatement(node);
        break;
    }
  }

  private traverseIfStatement(node: IfStatementNode): void {
    this.visitor.visitIfStatement(node);

    this.traverseIfClause(node.ifClause);

    for (const elseif of node.elseIfClauses ?? []) {
      this.traverseIfClause(elseif);
    }
    if (node.elseClause) {
      this.traverseElseClause(node.elseClause);
    }

    this.visitor.visitIfStatementEnd(node);
  }

  private traverseIfClause(node: IfClauseNode): void {
    this.visitor.visitIfClause(node);
    this.traverseExpression(node.condition);
    this.traverseStatements(node.body);
  }

  private traverseElseClause(node: ElseClauseNode): void {
    this.visitor.visitElseClause(node);
    this.traverseStatements(node.body);
  }

  private traverseExpression(node: ExpressionNode): void {
    switch (true) {
      case node instanceof FunctionCallNode:
        this.traverseFunctionCall(node);
        break;
      default:
        if (this.visitor.visitExpression)
          this.visitor.visitExpression(node);
        break;
    }
  }

  private traverseVariableAssignment(
    node: VariableAssignmentNode
  ): void {
    this.visitor.visitVariableAssignment(node);
    this.traverseExpression(node.value);
  }

  private traverseFunctionCall(node: FunctionCallNode): void {
    this.visitor.visitFunctionCall(node);
    this.traverseExpression(node.argument);
  }

  private traverseWhileStatement(node: WhileStatementNode): void {
    this.visitor.visitWhileStatement(node);
    this.traverseExpression(node.condition);
    this.traverseStatements(node.body);
    this.visitor.visitWhileStatementEnd(node);
  }

  private traverseMotionCommand(node: MotionCommandNode): void {
    this.visitor.visitMotionCommand(node);
    for (const param of node.getParameters()) {
      if (param instanceof AxisParameterNode) {
        this.traverseAxisParameter(param);
      }
    }
  }

  private traverseAxisParameter(node: AxisParameterNode): void {
    this.visitor.visitAxisParameter(node);
    this.traverseExpression(node.value);
  }
}
