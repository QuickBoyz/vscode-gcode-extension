/**
 * Diagnostics Provider
 *
 * Provides syntax error diagnostics (wavy red underlines) for G-code files.
 * Collects ErrorNodes from the AST and converts them to LSP diagnostics.
 */
import {
  Diagnostic,
  DiagnosticSeverity,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  DocumentStateManager,
  GCodeSettings,
} from "./DocumentStateManager";
import { AstTraverser } from "../_parser/AstTraverser";
import { AstVisitor } from "../_parser/AstVisitor";
import { ErrorNode, ProgramNode } from "../_parser/nodes";

/**
 * Visitor to collect ErrorNodes from the AST
 */
class ErrorNodeCollector extends AstVisitor<void> {
  private errors: ErrorNode[] = [];

  collectErrors(program: ProgramNode): ErrorNode[] {
    this.errors = [];
    const traverser = new AstTraverser(this);
    traverser.traverseProgram(program);
    return this.errors;
  }

  visitError(node: ErrorNode): void {
    this.errors.push(node);
  }

  // Required visitor methods - no-op for other node types
  visitVariableAssignment(): void {}
  visitFunctionCall(): void {}
  visitWhileStatement(): void {}
  visitWhileStatementEnd(): void {}
  visitIfStatement(): void {}
  visitIfStatementEnd(): void {}
  visitIfClause(): void {}
  visitElseClause(): void {}
  visitBlockStatement(): void {}
  visitMotionCommand(): void {}
  visitAxisParameter(): void {}
  visitComment(): void {}
  visitExpression(): void {}
  visitStatement(): void {}
  visitProgram(): void {}
  visitBinaryExpression(): void {}
  visitUnaryExpression(): void {}
  visitVariableReference(): void {}
  visitLiteralExpression(): void {}
}

/**
 * Diagnostics Provider
 *
 * Provides syntax error diagnostics for G-code documents.
 */
export class DiagnosticsProvider {
  constructor(private stateManager: DocumentStateManager) {}

  /**
   * Provide diagnostics (syntax errors) for a document
   */
  provideDiagnostics(
    document: TextDocument,
    settings: GCodeSettings
  ): Diagnostic[] {
    const state = this.stateManager.getOrParseDocumentFromTextDocument(
      document,
      settings
    );

    const collector = new ErrorNodeCollector();
    const errors = collector.collectErrors(state.ast);

    const diagnostics: Diagnostic[] = [];

    for (const errorNode of errors) {
      diagnostics.push({
        range: errorNode.getRange(),
        severity: DiagnosticSeverity.Error,
        message: errorNode.message,
        source: "gcode",
      });
    }

    return diagnostics;
  }
}
