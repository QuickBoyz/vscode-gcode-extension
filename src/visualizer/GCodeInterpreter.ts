/**
 * GCodeInterpreter
 *
 * Interprets a G-code AST with variable resolution, expression
 * evaluation, and control flow (WHILE loops, IF/ELSE branches).
 *
 * Unlike {@link AstTraverser} (which walks the tree exactly once),
 * this class evaluates conditions and repeats loop bodies while
 * maintaining a mutable variable environment.
 *
 * Motion commands are dispatched to a {@link MotionHandler} callback,
 * decoupling interpretation from path extraction.
 *
 * Architecture note: `interpretStatement()` uses `instanceof` dispatch
 * for {@link StatementNode} subtypes, mirroring the pattern in
 * {@link AstTraverser}. This is an accepted pragmatic compromise --
 * `StatementNode` does not expose an `accept()` method for
 * statement-level visitor dispatch.
 */
import {
  AxisParameterNode,
  IfStatementNode,
  MotionCommandNode,
  StatementNode,
  VariableAssignmentNode,
  WhileStatementNode,
} from '../parser/nodes';
import { ProgramNode } from '../parser/nodes/ProgramNode';
import { DEFAULT_GCODE_CONFIG, ExtractorConfig } from '../config';
import { normalizeCommand } from '../utils/GCodeNormalizer';
import { GCodeExpressionEvaluator } from './GCodeExpressionEvaluator';
import { MotionHandler } from './types';

/**
 * G-code Group 1 modal motion commands.
 * When one of these is issued, it becomes the active motion mode for
 * subsequent standalone axis parameters (e.g. "X10 Y20" without a G-code).
 */
const MODAL_MOTION_COMMANDS = new Set(['G00', 'G01', 'G02', 'G03']);

export class GCodeInterpreter {
  private readonly variableEnvironment = new Map<string | number, number>();
  private readonly expressionEvaluator: GCodeExpressionEvaluator;
  private readonly options: ExtractorConfig;
  private totalIterations = 0;
  private iterationLimitReached = false;

  /**
   * The last active motion command (modal state). In standard G-code,
   * once a motion command like G01 is issued, subsequent lines with
   * only axis parameters (e.g. "X10 Y20") continue using that command.
   * This is the most common pattern in CAM-generated G-code.
   */
  private activeMotionCommand: string | null = null;

  constructor(
    private readonly motionHandler: MotionHandler,
    options?: Partial<ExtractorConfig>
  ) {
    this.options = { ...DEFAULT_GCODE_CONFIG.extractor, ...options };
    this.expressionEvaluator = new GCodeExpressionEvaluator(this.variableEnvironment);
  }

  /** Whether the interpreter hit the max iteration limit. */
  get wasIterationLimitReached(): boolean {
    return this.iterationLimitReached;
  }

  /**
   * Interpret the entire program. Resets all internal state so the
   * same instance can be reused across multiple programs.
   */
  interpret(program: ProgramNode): void {
    this.variableEnvironment.clear();
    this.totalIterations = 0;
    this.iterationLimitReached = false;
    this.activeMotionCommand = null;
    this.interpretStatements(program.statements);
  }

  private interpretStatements(statements: readonly StatementNode[]): void {
    let pendingAxisParameters: AxisParameterNode[] = [];
    let pendingLine = -1;

    for (const statement of statements) {
      if (this.iterationLimitReached) return;

      if (statement instanceof AxisParameterNode) {
        const statementLine = statement.getRange().start.line;

        // If this axis parameter is on a different line than the pending
        // group, flush the previous group first — each source line with
        // standalone axis parameters is a separate modal motion command.
        if (pendingAxisParameters.length > 0 && statementLine !== pendingLine) {
          this.dispatchModalMotion(pendingAxisParameters);
          pendingAxisParameters = [];
        }

        pendingAxisParameters.push(statement);
        pendingLine = statementLine;
        continue;
      }

      // Flush any pending axis parameters before processing the next
      // non-axis statement.
      if (pendingAxisParameters.length > 0) {
        this.dispatchModalMotion(pendingAxisParameters);
        pendingAxisParameters = [];
      }

      this.interpretStatement(statement);
    }

    // Flush trailing axis parameters at the end of the statement list
    if (pendingAxisParameters.length > 0) {
      this.dispatchModalMotion(pendingAxisParameters);
    }
  }

  /**
   * Dispatches collected standalone axis parameters as a motion command
   * using the currently active modal motion command (e.g. G01).
   */
  private dispatchModalMotion(parameters: AxisParameterNode[]): void {
    if (this.activeMotionCommand === null) return;

    this.motionHandler.onMotionCommand(
      this.activeMotionCommand,
      parameters,
      this.expressionEvaluator
    );
  }

  private interpretStatement(node: StatementNode): void {
    if (node instanceof MotionCommandNode) {
      this.motionHandler.onMotionCommand(
        node.command,
        node.getParameters(),
        this.expressionEvaluator
      );

      // Only update the active modal motion command for Group 1 commands
      // (G00, G01, G02, G03). Non-modal commands (G17, G28, G90, etc.)
      // must not overwrite the active motion mode.
      if (MODAL_MOTION_COMMANDS.has(normalizeCommand(node.command))) {
        this.activeMotionCommand = node.command;
      }
    } else if (node instanceof VariableAssignmentNode) {
      this.interpretVariableAssignment(node);
    } else if (node instanceof WhileStatementNode) {
      this.interpretWhileStatement(node);
    } else if (node instanceof IfStatementNode) {
      this.interpretIfStatement(node);
    }
    // Other statement types (comments, line numbers, subroutine labels,
    // errors) are silently skipped.
  }

  private interpretVariableAssignment(node: VariableAssignmentNode): void {
    const value = this.expressionEvaluator.evaluate(node.value);
    if (value !== null) {
      this.variableEnvironment.set(node.name, value);
    }
  }

  private interpretWhileStatement(node: WhileStatementNode): void {
    while (!this.iterationLimitReached) {
      const conditionValue = this.expressionEvaluator.evaluate(node.condition);
      // In LinuxCNC, a condition is truthy when non-zero.
      if (conditionValue === null || conditionValue === 0) break;

      this.totalIterations++;
      if (this.totalIterations > this.options.maxIterations) {
        this.iterationLimitReached = true;
        return;
      }

      this.interpretStatements(node.body);
    }
  }

  private interpretIfStatement(node: IfStatementNode): void {
    // Check IF clause
    const ifConditionValue = this.expressionEvaluator.evaluate(node.ifClause.condition);
    if (ifConditionValue !== null && ifConditionValue !== 0) {
      this.interpretStatements(node.ifClause.body);
      return;
    }

    // Check ELSEIF clauses
    for (const elseIfClause of node.elseIfClauses ?? []) {
      const elseIfConditionValue = this.expressionEvaluator.evaluate(elseIfClause.condition);
      if (elseIfConditionValue !== null && elseIfConditionValue !== 0) {
        this.interpretStatements(elseIfClause.body);
        return;
      }
    }

    // Fall through to ELSE clause
    if (node.elseClause) {
      this.interpretStatements(node.elseClause.body);
    }
  }
}
