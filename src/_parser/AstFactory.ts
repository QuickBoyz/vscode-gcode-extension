// parser/factories/AstFactory.ts
import {
  BinaryOperatorType,
  UnaryOperatorType,
} from "../entities/expressions";
import { Token, TokenType } from "../entities/tokens";
import {
  AstNode,
  AxisParameterNode,
  BinaryExpressionNode,
  // BlockStatementNode,
  CommentNode,
  ErrorNode,
  ExpressionNode,
  FunctionCallNode,
  IfStatementNode,
  LiteralExpressionNode,
  MotionCommandNode,
  ProgramNode,
  StatementNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  VariableReferenceNode,
  WhileStatementNode,
  IfClauseNode,
  ElseClauseNode,
} from "./nodes";
import { rangeFrom } from "./helpers";

export class AstFactory {
  program(
    statements: StatementNode[],
    hasStartDelimiter: boolean = false,
    hasEndDelimiter: boolean = false
  ): ProgramNode {
    return new ProgramNode(
      statements,
      hasStartDelimiter,
      hasEndDelimiter
    );
  }

  variableAssignment(variable: Token, value: ExpressionNode) {
    return new VariableAssignmentNode(
      rangeFrom(variable, value),
      this.getVariableName(variable),
      value
    );
  }

  functionCall(func: Token, argument: ExpressionNode) {
    return new FunctionCallNode(
      rangeFrom(func, argument),
      func.value,
      argument
    );
  }

  ifClause(
    keyword: Token,
    condition: ExpressionNode,
    body: StatementNode[],
    label?: Token,
    parent?: AstNode
  ) {
    return new IfClauseNode(
      rangeFrom(keyword, body[body.length - 1]),
      keyword.type === TokenType.IF ? TokenType.IF : TokenType.ELSEIF,
      condition,
      body,
      label?.value,
      parent
    );
  }

  elseClause(
    keyword: Token,
    body: StatementNode[],
    label?: Token,
    parent?: AstNode
  ) {
    return new ElseClauseNode(
      rangeFrom(keyword, body[body.length - 1]),
      body,
      label?.value,
      parent
    );
  }

  ifStatement(args: {
    label?: Token;
    endLabel: Token;
    ifClause: IfClauseNode;
    elseClause?: ElseClauseNode;
    elseIfClauses?: IfClauseNode[];
  }) {
    const node = new IfStatementNode(
      rangeFrom(args.label, args.endLabel),
      args.ifClause,
      args.elseClause,
      args.elseIfClauses,
      args.label?.value
    );
    this.setParents(args.elseIfClauses ?? [], node);
    if (args.ifClause) {
      args.ifClause.setParent(node);
    }
    if (args.elseClause) {
      args.elseClause.setParent(node);
    }
    return node;
  }

  whileStatement(args: {
    label?: Token;
    condition: ExpressionNode;
    body: StatementNode[];
    whileToken: Token;
    endWhileToken: Token;
  }) {
    const node = new WhileStatementNode(
      rangeFrom(args.whileToken, args.endWhileToken),
      args.condition,
      args.body,
      args.label?.value
    );
    this.setParents(args.body, node);
    return node;
  }

  axisParam(axis: Token, value: ExpressionNode, parent?: AstNode) {
    return new AxisParameterNode(
      rangeFrom(axis),
      axis.value,
      value,
      parent
    );
  }

  binary(left: ExpressionNode, op: Token, right: ExpressionNode) {
    return new BinaryExpressionNode(
      rangeFrom(left, right),
      left,
      op.value as BinaryOperatorType,
      right
    );
  }

  unary(op: Token, expr: ExpressionNode) {
    return new UnaryExpressionNode(
      rangeFrom(op, expr),
      op.value as UnaryOperatorType,
      expr
    );
  }

  literal(token: Token) {
    return new LiteralExpressionNode(rangeFrom(token), token.value);
  }

  getVariableName(token: Token): string | number {
    const value = token.value;

    // Check for named variable: #<name>
    const namedMatch = value.match(/^#<([a-zA-Z_][a-zA-Z0-9_]*)>$/);
    if (namedMatch) {
      return namedMatch[1];
    }

    // Check for numeric variable: #123
    const numericMatch = value.match(/^#(\d+)$/);
    if (numericMatch) {
      return Number(numericMatch[1]);
    }

    // Fallback: return the token value as-is
    return value;
  }

  variableRef(token: Token) {
    return new VariableReferenceNode(
      rangeFrom(token),
      this.getVariableName(token)
    );
  }

  motionCommand(command: Token, params: AxisParameterNode[] = []) {
    const node = new MotionCommandNode(
      rangeFrom(command),
      command.value,
      params
    );
    this.setParents(params, node);
    return node;
  }

  error(message: string, token?: Token) {
    const range = token
      ? rangeFrom(token)
      : {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        };

    return new ErrorNode(range, message);
  }

  comment(token: Token) {
    return new CommentNode(rangeFrom(token), token.value);
  }

  setParents(nodes: AstNode[], parent: AstNode) {
    for (const node of nodes) {
      node.setParent(parent);
    }
  }
}
