// Parser/factories/AstFactory.ts
import { REGEX_PATTERNS } from '../constants';
import { KeywordType } from '../lexer/KeywordType';
import { LexerToken } from '../lexer/LexerToken';
import { rangeFrom } from './helpers';
import {
  AstNode,
  AxisParameterNode,
  BinaryExpressionNode,
  CommentNode,
  ElseClauseNode,
  ErrorNode,
  ExpressionNode,
  FunctionCallNode,
  IfClauseKind,
  IfClauseNode,
  IfStatementNode,
  LineNumberNode,
  LiteralExpressionNode,
  MotionCommandNode,
  ProgramNode,
  StatementNode,
  SubroutineLabelNode,
  UnaryExpressionNode,
  VariableAssignmentNode,
  VariableReferenceNode,
  WhileStatementNode,
} from './nodes';
import { BinaryOperatorType, UnaryOperatorType } from './nodes/expressions';

export class AstFactory {
  program(
    statements: StatementNode[],
    hasStartDelimiter: boolean = false,
    hasEndDelimiter: boolean = false
  ): ProgramNode {
    return new ProgramNode(statements, hasStartDelimiter, hasEndDelimiter);
  }

  variableAssignment(variable: LexerToken, value: ExpressionNode, parent?: AstNode) {
    return new VariableAssignmentNode(
      rangeFrom(variable, value),
      this.getVariableName(variable),
      value,
      rangeFrom(variable),
      parent
    );
  }

  functionCall(func: LexerToken, argument: ExpressionNode) {
    return new FunctionCallNode(rangeFrom(func, argument), func.value, argument, rangeFrom(func));
  }

  ifClause(
    keyword: LexerToken,
    condition: ExpressionNode,
    body: StatementNode[],
    label?: LexerToken,
    thenToken?: LexerToken,
    parent?: AstNode
  ) {
    return new IfClauseNode(
      rangeFrom(keyword, body[body.length - 1]),
      keyword.isKeyword(KeywordType.IF) ? IfClauseKind.IF : IfClauseKind.ELSEIF,
      condition,
      body,
      rangeFrom(keyword),
      rangeFrom(thenToken),
      label?.value,
      parent
    );
  }

  elseClause(keyword: LexerToken, body: StatementNode[], label?: LexerToken, parent?: AstNode) {
    return new ElseClauseNode(
      rangeFrom(keyword, body[body.length - 1]),
      body,
      rangeFrom(keyword),
      label?.value,
      parent
    );
  }

  ifStatement(args: {
    label?: LexerToken;
    endLabel: LexerToken;
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
    label?: LexerToken;
    condition: ExpressionNode;
    body: StatementNode[];
    whileToken: LexerToken;
    endWhileToken: LexerToken;
    doToken?: LexerToken;
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

  axisParam(axis: LexerToken, value: ExpressionNode, parent?: AstNode) {
    return new AxisParameterNode(rangeFrom(axis), axis.value, value, parent);
  }

  binary(left: ExpressionNode, op: LexerToken, right: ExpressionNode) {
    return new BinaryExpressionNode(
      rangeFrom(left, right),
      left,
      op.value as BinaryOperatorType,
      right,
      rangeFrom(op)
    );
  }

  unary(op: LexerToken, expr: ExpressionNode) {
    return new UnaryExpressionNode(
      rangeFrom(op, expr),
      op.value as UnaryOperatorType,
      expr,
      rangeFrom(op)
    );
  }

  literal(token: LexerToken) {
    return new LiteralExpressionNode(rangeFrom(token), token.value);
  }

  getVariableName(token: LexerToken): string | number {
    const { value } = token;
    // Check for named variable: #<name>
    const namedMatch = value.match(REGEX_PATTERNS.NAMED_VARIABLE);
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

  variableRef(token: LexerToken) {
    return new VariableReferenceNode(rangeFrom(token), this.getVariableName(token));
  }

  motionCommand(command: LexerToken, params: AxisParameterNode[] = []) {
    const node = new MotionCommandNode(rangeFrom(command), command.value, params);
    this.setParents(params, node);
    return node;
  }

  error(message: string, token?: LexerToken, originalText?: string) {
    const range = token
      ? rangeFrom(token)
      : {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        };

    return new ErrorNode(range, message, originalText);
  }

  subroutineLabel(token: LexerToken) {
    return new SubroutineLabelNode(rangeFrom(token), token.value);
  }

  lineNumber(token: LexerToken) {
    return new LineNumberNode(rangeFrom(token), token.value);
  }

  comment(token: LexerToken) {
    return new CommentNode(rangeFrom(token), token.value);
  }

  setParents(nodes: AstNode[], parent: AstNode) {
    for (const node of nodes) {
      node.setParent(parent);
    }
  }
}
