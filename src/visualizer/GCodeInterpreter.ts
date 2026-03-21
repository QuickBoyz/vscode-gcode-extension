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
  IfStatementNode,
  MotionCommandNode,
  StatementNode,
  VariableAssignmentNode,
  WhileStatementNode,
} from '../parser/nodes';
import { ProgramNode } from '../parser/nodes/ProgramNode';
import { GCodeExpressionEvaluator } from './GCodeExpressionEvaluator';
import {
  DEFAULT_INTERPRETER_OPTIONS,
  InterpreterOptions,
  MotionHandler,
} from './types';

export class GCodeInterpreter {
  private readonly variableEnvironment = new Map<string | number, number>();
  private readonly expressionEvaluator: GCodeExpressionEvaluator;
  private readonly options: InterpreterOptions;
  private totalIterations = 0;
  private iterationLimitReached = false;

  constructor(
    private readonly motionHandler: MotionHandler,
    options?: Partial<InterpreterOptions>
  ) {
    this.options = { ...DEFAULT_INTERPRETER_OPTIONS, ...options };
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
    this.interpretStatements(program.statements);
  }

  private interpretStatements(statements: readonly StatementNode[]): void {
    for (const statement of statements) {
      if (this.iterationLimitReached) return;
      this.interpretStatement(statement);
    }
  }

  private interpretStatement(node: StatementNode): void {
    if (node instanceof MotionCommandNode) {
      this.motionHandler.onMotionCommand(
        node.command,
        node.getParameters(),
        this.expressionEvaluator
      );
    } else if (node instanceof VariableAssignmentNode) {
      this.interpretVariableAssignment(node);
    } else if (node instanceof WhileStatementNode) {
      this.interpretWhileStatement(node);
    } else if (node instanceof IfStatementNode) {
      this.interpretIfStatement(node);
    }
    // Other statement types (comments, line numbers, subroutine labels,
    // axis parameters, errors) are silently skipped.
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
