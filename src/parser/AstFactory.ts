// Parser/factories/AstFactory.ts
import { REGEX_PATTERNS } from '../constants';
import { rangeFrom } from './helpers';
import {
  AstNode,
  AxisParameterNode,
  BinaryExpressionNode,
  // BlockStatementNode,
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
import { BinaryOperatorType, UnaryOperatorType } from './nodes/expressions';
import { Token, TokenType } from './nodes/tokens';

export class AstFactory {
  program(
    statements: StatementNode[],
    hasStartDelimiter: boolean = false,
    hasEndDelimiter: boolean = false
  ): ProgramNode {
    return new ProgramNode(statements, hasStartDelimiter, hasEndDelimiter);
  }

  variableAssignment(variable: Token, value: ExpressionNode, parent?: AstNode) {
    return new VariableAssignmentNode(
      rangeFrom(variable, value),
      this.getVariableName(variable),
      value,
      rangeFrom(variable),
      parent
    );
  }

  functionCall(func: Token, argument: ExpressionNode) {
    return new FunctionCallNode(rangeFrom(func, argument), func.value, argument, rangeFrom(func));
  }

  ifClause(
    keyword: Token,
    condition: ExpressionNode,
    body: StatementNode[],
    label?: Token,
    thenToken?: Token,
    parent?: AstNode
  ) {
    return new IfClauseNode(
      rangeFrom(keyword, body[body.length - 1]),
      keyword.type === TokenType.IF ? TokenType.IF : TokenType.ELSEIF,
      condition,
      body,
      rangeFrom(keyword),
      rangeFrom(thenToken),
      label?.value,
      parent
    );
  }

  elseClause(keyword: Token, body: StatementNode[], label?: Token, parent?: AstNode) {
    return new ElseClauseNode(
      rangeFrom(keyword, body[body.length - 1]),
      body,
      rangeFrom(keyword),
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
      rangeFrom(args.endLabel),
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
    doToken?: Token;
  }) {
    const node = new WhileStatementNode(
      rangeFrom(args.whileToken, args.endWhileToken),
      args.condition,
      args.body,
      rangeFrom(args.whileToken),
      rangeFrom(args.endWhileToken),
      rangeFrom(args.doToken),
      args.label?.value
    );
    this.setParents(args.body, node);
    return node;
  }

  axisParam(axis: Token, value: ExpressionNode, parent?: AstNode) {
    return new AxisParameterNode(rangeFrom(axis), axis.value, value, parent);
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
    return new UnaryExpressionNode(rangeFrom(op, expr), op.value as UnaryOperatorType, expr);
  }

  literal(token: Token) {
    return new LiteralExpressionNode(rangeFrom(token), token.value);
  }

  getVariableName(token: Token): string | number {
    const { value } = token,
      // Check for named variable: #<name>
      namedMatch = value.match(REGEX_PATTERNS.NAMED_VARIABLE);
    if (namedMatch) {
      return namedMatch[1];
    }

    // Check for numeric variable: #123
    const numericMatch = value.match(REGEX_PATTERNS.NUMERIC_VARIABLE);
    if (numericMatch) {
      return Number(numericMatch[1]);
    }

    // Fallback: return the token value as-is
    return value;
  }

  variableRef(token: Token) {
    return new VariableReferenceNode(rangeFrom(token), this.getVariableName(token));
  }

  motionCommand(command: Token, params: AxisParameterNode[] = []) {
    const node = new MotionCommandNode(rangeFrom(command), command.value, params);
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
