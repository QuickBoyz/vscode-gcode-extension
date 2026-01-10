import { SemanticTokens, SemanticTokensLegend } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { GCodeLexer } from '../lexer/GCodeLexer';
import { AstTraverser } from '../parser/AstTraverser';
import { AstVisitor } from '../parser/AstVisitor';
import { GCodeParser } from '../parser/GCodeParser';
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
} from '../parser/nodes';
import { GCodeSemanticTokensBuilder } from './SemanticTokensBuilder';

export const SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
  tokenTypes: ['keyword', 'variable', 'number', 'comment', 'function', 'parameter', 'label'],
  tokenModifiers: [],
};

export class SemanticTokensProvider extends AstVisitor<void> {
  private builder: GCodeSemanticTokensBuilder;

  constructor() {
    super();
    this.builder = new GCodeSemanticTokensBuilder();
  }

  static provide(document: TextDocument): SemanticTokens {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(document.getText()),
      parser = new GCodeParser(tokens),
      program = parser.parseProgram(),
      provider = new SemanticTokensProvider(),
      traverser = new AstTraverser(provider);
    traverser.traverseProgram(program);

    return provider.builder.build();
  }

  visitBinaryExpression(_node: BinaryExpressionNode): void {}
  visitBlockStatement(_node: BlockStatementNode): void {}
  visitExpression(_node: ExpressionNode): void {}
  visitStatement(_node: StatementNode): void {}
  visitProgram(_node: ProgramNode): void {}
  visitIfClause(_node: IfClauseNode): void {}
  visitElseClause(_node: ElseClauseNode): void {}
  visitUnaryExpression(_node: UnaryExpressionNode): void {}
  visitError(_node: ErrorNode): void {}

  visitIfStatementEnd(node: IfStatementNode): void {
    this.builder.pushRange(node.endIfTokenRange, this.getTokenTypeIndex('keyword'));
  }

  visitMotionCommand(node: MotionCommandNode) {
    this.builder.pushRange(node.getRange(), this.getTokenTypeIndex('keyword'));
  }

  visitAxisParameter(node: AxisParameterNode) {
    this.builder.pushRange(node.getRange(), this.getTokenTypeIndex('parameter'));
  }

  visitVariableAssignment(node: VariableAssignmentNode): void {
    this.builder.pushRange(node.variableTokenRange, this.getTokenTypeIndex('variable'));
  }

  visitVariableReference(node: VariableReferenceNode) {
    this.builder.pushRange(node.getRange(), this.getTokenTypeIndex('variable'));
  }

  visitLiteralExpression(node: LiteralExpressionNode) {
    this.builder.pushRange(node.getRange(), this.getTokenTypeIndex('number'));
  }

  visitComment(node: CommentNode) {
    this.builder.pushRange(node.getRange(), this.getTokenTypeIndex('comment'));
  }

  visitFunctionCall(node: FunctionCallNode) {
    this.builder.pushRange(node.funcTokenRange, this.getTokenTypeIndex('function'));
  }

  visitIfStatement(node: IfStatementNode) {
    this.builder.pushRange(node.ifClause.getRange(), this.getTokenTypeIndex('keyword'));

    if (node.ifClause.thenTokenRange) {
      this.builder.pushRange(node.ifClause.thenTokenRange, this.getTokenTypeIndex('keyword'));
    }

    // Add semantic tokens for THEN in elseIfClauses
    if (node.elseIfClauses) {
      for (const elseifClause of node.elseIfClauses) {
        if (elseifClause.thenTokenRange) {
          this.builder.pushRange(elseifClause.thenTokenRange, this.getTokenTypeIndex('keyword'));
        }
      }
    }
  }

  visitWhileStatement(node: WhileStatementNode) {
    this.builder.pushRange(node.whileTokenRange, this.getTokenTypeIndex('keyword'));

    if (node.doTokenRange) {
      this.builder.pushRange(node.doTokenRange, this.getTokenTypeIndex('keyword'));
    }
  }

  visitWhileStatementEnd(node: WhileStatementNode) {
    this.builder.pushRange(node.endWhileTokenRange, this.getTokenTypeIndex('keyword'));
  }

  // --- Helpers ---

  private getTokenTypeIndex(tokenType: string) {
    return SEMANTIC_TOKENS_LEGEND.tokenTypes.indexOf(tokenType);
  }
}
