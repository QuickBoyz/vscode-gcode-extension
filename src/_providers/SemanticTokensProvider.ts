import {
  SemanticTokens,
  SemanticTokensLegend,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AstTraverser } from "../_parser/AstTraverser";
import { AstVisitor } from "../_parser/AstVisitor";
import { GCodeParser } from "../_parser/GCodeParser";
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
} from "../_parser/nodes";
import { gcodeLexer } from "../lexer";
import { GCodeSemanticTokensBuilder } from "./SemanticTokensBuilder";

export const SEMANTIC_TOKENS_LEGEND: SemanticTokensLegend = {
  tokenTypes: [
    "keyword",
    "variable",
    "number",
    "comment",
    "function",
    "parameter",
    "label",
  ],
  tokenModifiers: [],
};

export class SemanticTokensProvider extends AstVisitor<void> {
  private builder: GCodeSemanticTokensBuilder;

  constructor() {
    super();
    this.builder = new GCodeSemanticTokensBuilder();
  }

  static provide(document: TextDocument): SemanticTokens {
    const tokens = gcodeLexer.tokenize(document.getText());
    const parser = new GCodeParser(tokens);
    const program = parser.parseProgram();

    const provider = new SemanticTokensProvider();
    const traverser = new AstTraverser(provider);
    traverser.traverseProgram(program);

    return provider.builder.build();
  }

  visitBinaryExpression(node: BinaryExpressionNode): void {}
  visitBlockStatement(node: BlockStatementNode): void {}
  visitExpression(node: ExpressionNode): void {}
  visitStatement(node: StatementNode): void {}
  visitProgram(node: ProgramNode): void {}
  visitVariableAssignment(node: VariableAssignmentNode): void {}
  visitWhileStatementEnd(node: WhileStatementNode): void {}
  visitIfClause(node: IfClauseNode): void {}
  visitElseClause(node: ElseClauseNode): void {}
  visitIfStatementEnd(node: IfStatementNode): void {}
  visitUnaryExpression(node: UnaryExpressionNode): void {}
  visitError(node: ErrorNode): void {}

  visitMotionCommand(node: MotionCommandNode) {
    this.builder.pushRange(
      node.getRange(),
      this.getTokenTypeIndex("keyword")
    );
  }

  visitAxisParameter(node: AxisParameterNode) {
    this.builder.pushRange(
      node.getRange(),
      this.getTokenTypeIndex("parameter")
    );
  }

  visitVariableReference(node: VariableReferenceNode) {
    const text =
      typeof node.name === "number"
        ? `#${node.name}`
        : `#<${node.name}>`;

    this.builder.push(
      node.getRange().start.line,
      node.getRange().start.character,
      text.length,
      this.getTokenTypeIndex("variable")
    );
  }

  visitLiteralExpression(node: LiteralExpressionNode) {
    const text = node.value.toString();
    this.builder.push(
      node.getRange().start.line,
      node.getRange().start.character,
      text.length,
      this.getTokenTypeIndex("number")
    );
  }

  visitComment(node: CommentNode) {
    this.builder.pushRange(
      node.getRange(),
      this.getTokenTypeIndex("comment")
    );
  }

  visitFunctionCall(node: FunctionCallNode) {
    this.builder.pushRange(
      node.getRange(),
      this.getTokenTypeIndex("function")
    );
  }

  visitIfStatement(node: IfStatementNode) {
    this.builder.pushRange(
      node.getRange(),
      this.getTokenTypeIndex("keyword")
    );
  }

  visitWhileStatement(node: WhileStatementNode) {
    this.builder.pushRange(
      node.getRange(),
      this.getTokenTypeIndex("keyword")
    );
  }

  // --- Helpers ---

  private getTokenTypeIndex(tokenType: string) {
    return SEMANTIC_TOKENS_LEGEND.tokenTypes.indexOf(tokenType);
  }
}
