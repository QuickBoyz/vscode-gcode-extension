// Parser/factories/AstFactory.ts
import { REGEX_PATTERNS } from '../constants';
import { KeywordType } from '../lexer/types';
import { LexerToken } from '../lexer/LexerToken';
import {
  AstNode,
  AxisParameterNode,
  BinaryExpressionNode,
  CommentNode,
  DiagnosticCategory,
  ElseClauseNode,
  ErrorNode,
  ParserDiagnosticCode,
  ExpressionNode,
  FunctionCallNode,
  IfClauseKind,
  IfClauseNode,
  IfStatementNode,
  LineNumberNode,
  LiteralExpressionNode,
  MotionCommandNode,
  ProgramDelimiterNode,
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
      this.rangeFrom(variable, value),
      this.getVariableName(variable),
      value,
      this.rangeFrom(variable),
      parent
    );
  }

  functionCall(func: LexerToken, argument: ExpressionNode) {
    return new FunctionCallNode(
      this.rangeFrom(func, argument),
      func.value,
      argument,
      this.rangeFrom(func)
    );
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
      this.rangeFrom(keyword, body[body.length - 1]),
      keyword.isKeyword(KeywordType.IF) ? IfClauseKind.IF : IfClauseKind.ELSEIF,
      condition,
      body,
      this.rangeFrom(keyword),
      this.rangeFrom(thenToken),
      label?.value,
      parent
    );
  }

  elseClause(keyword: LexerToken, body: StatementNode[], label?: LexerToken, parent?: AstNode) {
    return new ElseClauseNode(
      this.rangeFrom(keyword, body[body.length - 1]),
      body,
      this.rangeFrom(keyword),
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
      this.rangeFrom(args.label ?? args.ifClause, args.endLabel),
      args.ifClause,
      this.rangeFrom(args.endLabel),
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
      this.rangeFrom(args.whileToken, args.endWhileToken),
      args.condition,
      args.body,
      this.rangeFrom(args.whileToken),
      this.rangeFrom(args.endWhileToken),
      {
        doTokenRange: this.rangeFrom(args.doToken),
        label: args.label?.value,
        doSuffix: args.doToken?.keywordSuffix,
        endSuffix: args.endWhileToken.keywordSuffix,
      }
    );
    this.setParents(args.body, node);
    return node;
  }

  axisParam(axis: LexerToken, value: ExpressionNode, parent?: AstNode) {
    return new AxisParameterNode(this.rangeFrom(axis), axis.value, value, parent);
  }

  binary(left: ExpressionNode, op: LexerToken, right: ExpressionNode) {
    return new BinaryExpressionNode(
      this.rangeFrom(left, right),
      left,
      op.value as BinaryOperatorType,
      right,
      this.rangeFrom(op)
    );
  }

  unary(op: LexerToken, expr: ExpressionNode) {
    return new UnaryExpressionNode(
      this.rangeFrom(op, expr),
      op.value as UnaryOperatorType,
      expr,
      this.rangeFrom(op)
    );
  }

  literal(token: LexerToken) {
    return new LiteralExpressionNode(this.rangeFrom(token), token.value);
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
    return new VariableReferenceNode(this.rangeFrom(token), this.getVariableName(token));
  }

  motionCommand(command: LexerToken, params: AxisParameterNode[] = []) {
    const node = new MotionCommandNode(this.rangeFrom(command), command.value, params);
    this.setParents(params, node);
    return node;
  }

  error(
    message: string,
    token?: LexerToken,
    originalText?: string,
    parent: AstNode | undefined = undefined,
    category: DiagnosticCategory = DiagnosticCategory.Error,
    code?: ParserDiagnosticCode
  ) {
    const range = token
      ? this.rangeFrom(token)
      : {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        };

    return new ErrorNode(range, message, originalText, parent, category, code);
  }

  subroutineDefinition(args: {
    label: LexerToken;
    subToken: LexerToken;
    body: StatementNode[];
    endToken: LexerToken;
  }): SubroutineDefinitionNode {
    const node = new SubroutineDefinitionNode(
      this.rangeFrom(args.label, args.endToken),
      args.label.value,
      args.body,
      this.rangeFrom(args.label),
      this.rangeFrom(args.endToken)
    );
    this.setParents(args.body, node);
    return node;
  }

  subroutineCall(args: {
    callToken: LexerToken;
    target: string;
    callArguments: ExpressionNode[];
    lastToken: LexerToken | AstNode;
    repeatCount?: ExpressionNode;
  }): SubroutineCallNode {
    return new SubroutineCallNode(
      this.rangeFrom(args.callToken, args.repeatCount ?? args.lastToken),
      args.target,
      this.rangeFrom(args.callToken),
      args.callArguments,
      args.repeatCount
    );
  }

  returnStatement(args: { returnToken: LexerToken; label?: LexerToken }): ReturnStatementNode {
    return new ReturnStatementNode(
      this.rangeFrom(args.label ?? args.returnToken, args.returnToken),
      args.label?.value,
      this.rangeFrom(args.returnToken)
    );
  }

  subroutineLabel(token: LexerToken) {
    return new SubroutineLabelNode(this.rangeFrom(token), token.value);
  }

  lineNumber(token: LexerToken) {
    return new LineNumberNode(this.rangeFrom(token), token.value);
  }

  comment(token: LexerToken) {
    return new CommentNode(this.rangeFrom(token), token.value);
  }

  programDelimiter(token: LexerToken) {
    return new ProgramDelimiterNode(this.rangeFrom(token));
  }

  setParents(nodes: AstNode[], parent: AstNode) {
    for (const node of nodes) {
      node.setParent(parent);
    }
  }

  rangeFrom(start?: LexerToken | AstNode, end?: LexerToken | AstNode): Range {
    if (!start) {
      return {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      };
    }

    const startPos =
        start instanceof LexerToken
          ? {
              line: start.line - 1,
              character: start.col - 1,
            }
          : start.getRange().start,
      endSource = end ?? start,
      endPos =
        endSource instanceof LexerToken
          ? {
              line: endSource.line - 1,
              character: endSource.col - 1 + endSource.value.length,
            }
          : endSource.getRange().end;

    return { start: startPos, end: endPos };
  }
}
