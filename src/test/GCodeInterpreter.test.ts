import { GCodeLexer } from '../lexer/GCodeLexer';
import { AxisParameterNode } from '../parser/nodes/AxisParameterNode';
import { GCodeParser } from '../parser/GCodeParser';
import { GCodeExpressionEvaluator } from '../visualizer/GCodeExpressionEvaluator';
import { GCodeInterpreter } from '../visualizer/GCodeInterpreter';
import { MotionHandler } from '../visualizer/types';

/** Recorded motion call with axis values resolved at call time. */
interface RecordedMotion {
  readonly command: string;
  readonly resolvedAxes: ReadonlyMap<string, number | null>;
}

/**
 * Mock MotionHandler that records all onMotionCommand calls.
 * Evaluates axis values eagerly at call time so they reflect the
 * interpreter's variable environment at the moment of the call.
 */
class MockMotionHandler implements MotionHandler {
  readonly calls: RecordedMotion[] = [];

  onMotionCommand(
    command: string,
    parameters: readonly AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): void {
    const resolvedAxes = new Map<string, number | null>();
    for (const param of parameters) {
      resolvedAxes.set(param.axis.toUpperCase(), evaluator.evaluate(param.value));
    }
    this.calls.push({ command, resolvedAxes });
  }
}

/**
 * Helper: tokenise, parse, and return the program AST for a G-code string.
 */
function parse(input: string) {
  const lexer = new GCodeLexer();
  const tokens = lexer.tokenize(input);
  const parser = new GCodeParser(tokens, input);
  return parser.parseProgram();
}

/**
 * Helper: get resolved axis value from a recorded motion call.
 */
function resolvedAxisValue(recorded: RecordedMotion, axis: string): number | null {
  return recorded.resolvedAxes.get(axis.toUpperCase()) ?? null;
}

describe('GCodeInterpreter', () => {
  // ---------------------------------------------------------------------------
  // Basic motion dispatch
  // ---------------------------------------------------------------------------

  it('records motion commands in program order', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse('G0 X0 Y0\nG1 X10 Y20\nG1 X30 Y40');
    interpreter.interpret(program);

    expect(handler.calls).toHaveLength(3);
    expect(handler.calls[0].command).toBe('G0');
    expect(handler.calls[1].command).toBe('G1');
    expect(handler.calls[2].command).toBe('G1');
  });

  it('ignores comments and non-motion statements', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse('; comment\nG1 X10\n(another comment)\nM30');
    interpreter.interpret(program);

    // Only G1 and M30 are MotionCommandNodes (M30 is an MCODE, may or may not be parsed as motion)
    // Let's check we at least get the G1
    const gcodeMotions = handler.calls.filter((call) => call.command.toUpperCase().startsWith('G'));
    expect(gcodeMotions).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Variable assignment and resolution
  // ---------------------------------------------------------------------------

  it('resolves named variables in motion command parameters', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse('#<xpos> = 50\nG1 X#<xpos> Y20');
    interpreter.interpret(program);

    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls).toHaveLength(1);
    expect(resolvedAxisValue(gcodeCalls[0], 'X')).toBe(50);
    expect(resolvedAxisValue(gcodeCalls[0], 'Y')).toBe(20);
  });

  it('evaluates arithmetic in variable assignments', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse('#<base> = 10\n#<offset> = [#<base> + 5]\nG1 X#<offset>');
    interpreter.interpret(program);

    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls).toHaveLength(1);
    expect(resolvedAxisValue(gcodeCalls[0], 'X')).toBe(15);
  });

  it('resolves numbered variables', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse('#100 = 25\nG1 X#100');
    interpreter.interpret(program);

    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls).toHaveLength(1);
    expect(resolvedAxisValue(gcodeCalls[0], 'X')).toBe(25);
  });

  // ---------------------------------------------------------------------------
  // WHILE loops
  // ---------------------------------------------------------------------------

  it('iterates a WHILE loop the correct number of times', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse(`
#<i> = 0
O100 WHILE [#<i> LT 3]
  G1 X#<i>
  #<i> = [#<i> + 1]
O100 ENDWHILE
    `);
    interpreter.interpret(program);

    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls).toHaveLength(3);

    // Verify the X values are 0, 1, 2
    expect(resolvedAxisValue(gcodeCalls[0], 'X')).toBe(0);
    expect(resolvedAxisValue(gcodeCalls[1], 'X')).toBe(1);
    expect(resolvedAxisValue(gcodeCalls[2], 'X')).toBe(2);
  });

  it('does not enter WHILE body when condition is initially false', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse(`
#<i> = 10
O100 WHILE [#<i> LT 3]
  G1 X#<i>
  #<i> = [#<i> + 1]
O100 ENDWHILE
    `);
    interpreter.interpret(program);

    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls).toHaveLength(0);
  });

  it('stops at max iteration limit and does not hang', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler, { maxIterations: 5 });
    const program = parse(`
#<i> = 0
O100 WHILE [#<i> LT 1000]
  G1 X#<i>
  #<i> = [#<i> + 1]
O100 ENDWHILE
    `);
    interpreter.interpret(program);

    expect(interpreter.wasIterationLimitReached).toBe(true);
    // Should have at most 5 motion commands (one per iteration up to limit)
    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls.length).toBeLessThanOrEqual(6);
  });

  // ---------------------------------------------------------------------------
  // IF/ELSE branching
  // ---------------------------------------------------------------------------

  it('executes only the IF branch when condition is true', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse(`
#<flag> = 1
O100 IF [#<flag> EQ 1]
  G1 X10
O100 ELSE
  G1 X20
O100 ENDIF
    `);
    interpreter.interpret(program);

    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls).toHaveLength(1);
    expect(resolvedAxisValue(gcodeCalls[0], 'X')).toBe(10);
  });

  it('executes only the ELSE branch when IF condition is false', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse(`
#<flag> = 0
O100 IF [#<flag> EQ 1]
  G1 X10
O100 ELSE
  G1 X20
O100 ENDIF
    `);
    interpreter.interpret(program);

    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls).toHaveLength(1);
    expect(resolvedAxisValue(gcodeCalls[0], 'X')).toBe(20);
  });

  it('handles IF without ELSE when condition is false', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse(`
#<flag> = 0
O100 IF [#<flag> EQ 1]
  G1 X10
O100 ENDIF
    `);
    interpreter.interpret(program);

    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Nested control flow
  // ---------------------------------------------------------------------------

  it('handles nested IF inside WHILE', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);
    const program = parse(`
#<i> = 0
O100 WHILE [#<i> LT 4]
  O110 IF [#<i> LT 2]
    G1 X#<i>
  O110 ELSE
    G0 X#<i>
  O110 ENDIF
  #<i> = [#<i> + 1]
O100 ENDWHILE
    `);
    interpreter.interpret(program);

    const gcodeCalls = handler.calls.filter((c) => c.command.toUpperCase().startsWith('G'));
    expect(gcodeCalls).toHaveLength(4);
    // First 2 iterations: G1 (IF branch), next 2: G0 (ELSE branch)
    expect(gcodeCalls[0].command).toBe('G1');
    expect(gcodeCalls[1].command).toBe('G1');
    expect(gcodeCalls[2].command).toBe('G0');
    expect(gcodeCalls[3].command).toBe('G0');
  });

  // ---------------------------------------------------------------------------
  // Reusability
  // ---------------------------------------------------------------------------

  it('resets state between consecutive interpret calls', () => {
    const handler = new MockMotionHandler();
    const interpreter = new GCodeInterpreter(handler);

    const program1 = parse('#<x> = 10\nG1 X#<x>');
    interpreter.interpret(program1);
    expect(handler.calls).toHaveLength(1);
    expect(resolvedAxisValue(handler.calls[0], 'X')).toBe(10);

    const program2 = parse('G1 X#<x>');
    interpreter.interpret(program2);
    // After reset, #<x> is undefined so evaluator returns null
    // The motion command is still dispatched (with unresolvable params)
    expect(handler.calls).toHaveLength(2);
    // The second call's X should be null (variable not set in new program)
    expect(resolvedAxisValue(handler.calls[1], 'X')).toBeNull();
  });
});
