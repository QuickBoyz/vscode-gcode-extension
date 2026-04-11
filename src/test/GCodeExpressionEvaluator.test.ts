import { BinaryExpressionNode } from '../parser/nodes/expressions/BinaryExpressionNode';
import { LiteralExpressionNode } from '../parser/nodes/expressions/LiteralExpressionNode';
import {
  BinaryOperatorType,
  RelationalOperatorType,
  UnaryOperatorType,
} from '../parser/nodes/expressions/types';
import { UnaryExpressionNode } from '../parser/nodes/expressions/UnaryExpressionNode';
import { FunctionCallNode } from '../parser/nodes/FunctionCallNode';
import { Range } from '../parser/nodes/Range';
import { VariableReferenceNode } from '../parser/nodes/VariableReferenceNode';
import { GCodeExpressionEvaluator } from '../visualizer/GCodeExpressionEvaluator';
import { VariableEnvironment } from '../visualizer/VariableEnvironment';

/** Shorthand range for test nodes. */
const R = Range.create(0, 0, 0, 0);

describe('GCodeExpressionEvaluator', () => {
  // ---------------------------------------------------------------------------
  // Literals
  // ---------------------------------------------------------------------------

  it('evaluates a positive numeric literal', () => {
    const node = new LiteralExpressionNode(R, 42);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(42);
  });

  it('evaluates a string literal that parses to a number', () => {
    const node = new LiteralExpressionNode(R, '3.14');
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeCloseTo(3.14);
  });

  it('returns null for a non-numeric string literal', () => {
    const node = new LiteralExpressionNode(R, 'hello');
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeNull();
  });

  it('evaluates zero literal', () => {
    const node = new LiteralExpressionNode(R, 0);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Unary negation
  // ---------------------------------------------------------------------------

  it('evaluates negated literal', () => {
    const inner = new LiteralExpressionNode(R, 10);
    const node = new UnaryExpressionNode(R, UnaryOperatorType.Minus, inner, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(-10);
  });

  it('returns null when negating an unresolvable expression', () => {
    const unknownVariable = new VariableReferenceNode(R, 'unknown');
    const node = new UnaryExpressionNode(R, UnaryOperatorType.Minus, unknownVariable, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Variable references
  // ---------------------------------------------------------------------------

  it('resolves a named variable reference from environment', () => {
    const environment = VariableEnvironment.fromEntries(
      new Map<string | number, number>([['x_max', 619]])
    );
    const evaluator = new GCodeExpressionEvaluator(environment);
    const node = new VariableReferenceNode(R, 'x_max');
    expect(evaluator.evaluate(node)).toBe(619);
  });

  it('resolves a numbered variable reference from environment', () => {
    const environment = VariableEnvironment.fromEntries(
      new Map<string | number, number>([[100, 25.4]])
    );
    const evaluator = new GCodeExpressionEvaluator(environment);
    const node = new VariableReferenceNode(R, 100);
    expect(evaluator.evaluate(node)).toBeCloseTo(25.4);
  });

  it('returns null for an unknown variable', () => {
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    const node = new VariableReferenceNode(R, 'undefined_var');
    expect(evaluator.evaluate(node)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Arithmetic operators
  // ---------------------------------------------------------------------------

  it('evaluates addition', () => {
    const left = new LiteralExpressionNode(R, 10);
    const right = new LiteralExpressionNode(R, 5);
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Add, right, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(15);
  });

  it('evaluates subtraction', () => {
    const left = new LiteralExpressionNode(R, 10);
    const right = new LiteralExpressionNode(R, 3);
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Subtract, right, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(7);
  });

  it('evaluates multiplication', () => {
    const left = new LiteralExpressionNode(R, 4);
    const right = new LiteralExpressionNode(R, 7);
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Multiply, right, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(28);
  });

  it('evaluates division', () => {
    const left = new LiteralExpressionNode(R, 20);
    const right = new LiteralExpressionNode(R, 4);
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Divide, right, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(5);
  });

  it('returns null for division by zero', () => {
    const left = new LiteralExpressionNode(R, 10);
    const right = new LiteralExpressionNode(R, 0);
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Divide, right, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeNull();
  });

  it('evaluates MOD', () => {
    const left = new LiteralExpressionNode(R, 10);
    const right = new LiteralExpressionNode(R, 3);
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Mod, right, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(1);
  });

  it('returns null for MOD by zero', () => {
    const left = new LiteralExpressionNode(R, 10);
    const right = new LiteralExpressionNode(R, 0);
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Mod, right, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeNull();
  });

  it('returns null if left operand is null', () => {
    const left = new VariableReferenceNode(R, 'unknown');
    const right = new LiteralExpressionNode(R, 5);
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Add, right, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeNull();
  });

  it('returns null if right operand is null', () => {
    const left = new LiteralExpressionNode(R, 5);
    const right = new VariableReferenceNode(R, 'unknown');
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Add, right, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Relational operators (return 1 for true, 0 for false)
  // ---------------------------------------------------------------------------

  it('evaluates GT (greater than)', () => {
    const left = new LiteralExpressionNode(R, 10);
    const right = new LiteralExpressionNode(R, 5);
    const nodeTrue = new BinaryExpressionNode(
      R,
      left,
      RelationalOperatorType.GT as unknown as BinaryOperatorType,
      right,
      R
    );
    const nodeFalse = new BinaryExpressionNode(
      R,
      right,
      RelationalOperatorType.GT as unknown as BinaryOperatorType,
      left,
      R
    );
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(nodeTrue)).toBe(1);
    expect(evaluator.evaluate(nodeFalse)).toBe(0);
  });

  it('evaluates LT (less than)', () => {
    const left = new LiteralExpressionNode(R, 3);
    const right = new LiteralExpressionNode(R, 7);
    const node = new BinaryExpressionNode(
      R,
      left,
      RelationalOperatorType.LT as unknown as BinaryOperatorType,
      right,
      R
    );
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(1);
  });

  it('evaluates EQ (equal)', () => {
    const left = new LiteralExpressionNode(R, 5);
    const right = new LiteralExpressionNode(R, 5);
    const node = new BinaryExpressionNode(
      R,
      left,
      RelationalOperatorType.EQ as unknown as BinaryOperatorType,
      right,
      R
    );
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(1);
  });

  it('evaluates NE (not equal)', () => {
    const left = new LiteralExpressionNode(R, 5);
    const right = new LiteralExpressionNode(R, 3);
    const node = new BinaryExpressionNode(
      R,
      left,
      RelationalOperatorType.NE as unknown as BinaryOperatorType,
      right,
      R
    );
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(1);
  });

  it('evaluates LE (less than or equal)', () => {
    const equalLeft = new LiteralExpressionNode(R, 5);
    const equalRight = new LiteralExpressionNode(R, 5);
    const nodeEqual = new BinaryExpressionNode(
      R,
      equalLeft,
      RelationalOperatorType.LE as unknown as BinaryOperatorType,
      equalRight,
      R
    );
    const lessLeft = new LiteralExpressionNode(R, 3);
    const lessRight = new LiteralExpressionNode(R, 5);
    const nodeLess = new BinaryExpressionNode(
      R,
      lessLeft,
      RelationalOperatorType.LE as unknown as BinaryOperatorType,
      lessRight,
      R
    );
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(nodeEqual)).toBe(1);
    expect(evaluator.evaluate(nodeLess)).toBe(1);
  });

  it('evaluates GE (greater than or equal)', () => {
    const equalLeft = new LiteralExpressionNode(R, 5);
    const equalRight = new LiteralExpressionNode(R, 5);
    const nodeEqual = new BinaryExpressionNode(
      R,
      equalLeft,
      RelationalOperatorType.GE as unknown as BinaryOperatorType,
      equalRight,
      R
    );
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(nodeEqual)).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Nested expressions
  // ---------------------------------------------------------------------------

  it('evaluates nested arithmetic expressions', () => {
    // (10 + 5) * 2 = 30
    const innerLeft = new LiteralExpressionNode(R, 10);
    const innerRight = new LiteralExpressionNode(R, 5);
    const innerAdd = new BinaryExpressionNode(R, innerLeft, BinaryOperatorType.Add, innerRight, R);
    const outerRight = new LiteralExpressionNode(R, 2);
    const outerMul = new BinaryExpressionNode(
      R,
      innerAdd,
      BinaryOperatorType.Multiply,
      outerRight,
      R
    );
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(outerMul)).toBe(30);
  });

  it('evaluates expression with variable and arithmetic', () => {
    // #<base> + 5  where #<base>=10 => 15
    const environment = VariableEnvironment.fromEntries(
      new Map<string | number, number>([['base', 10]])
    );
    const evaluator = new GCodeExpressionEvaluator(environment);
    const varRef = new VariableReferenceNode(R, 'base');
    const literal = new LiteralExpressionNode(R, 5);
    const node = new BinaryExpressionNode(R, varRef, BinaryOperatorType.Add, literal, R);
    expect(evaluator.evaluate(node)).toBe(15);
  });

  // ---------------------------------------------------------------------------
  // Function calls
  // ---------------------------------------------------------------------------

  it('evaluates ABS function', () => {
    const argument = new LiteralExpressionNode(R, -17);
    const node = new FunctionCallNode(R, 'ABS', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(17);
  });

  it('evaluates ROUND function', () => {
    const argument = new LiteralExpressionNode(R, 3.7);
    const node = new FunctionCallNode(R, 'ROUND', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(4);
  });

  it('evaluates FIX (floor) function', () => {
    const argument = new LiteralExpressionNode(R, 3.9);
    const node = new FunctionCallNode(R, 'FIX', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(3);
  });

  it('evaluates FUP (ceil) function', () => {
    const argument = new LiteralExpressionNode(R, 3.1);
    const node = new FunctionCallNode(R, 'FUP', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(4);
  });

  it('evaluates SQRT function', () => {
    const argument = new LiteralExpressionNode(R, 16);
    const node = new FunctionCallNode(R, 'SQRT', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(4);
  });

  it('evaluates SIN function', () => {
    const argument = new LiteralExpressionNode(R, 0);
    const node = new FunctionCallNode(R, 'SIN', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(0);
  });

  it('evaluates COS function', () => {
    const argument = new LiteralExpressionNode(R, 0);
    const node = new FunctionCallNode(R, 'COS', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(1);
  });

  it('evaluates LN function with valid argument', () => {
    const argument = new LiteralExpressionNode(R, Math.E);
    const node = new FunctionCallNode(R, 'LN', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeCloseTo(1);
  });

  it('returns null for LN of zero or negative', () => {
    const argument = new LiteralExpressionNode(R, 0);
    const node = new FunctionCallNode(R, 'LN', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeNull();
  });

  it('returns null for unknown function', () => {
    const argument = new LiteralExpressionNode(R, 5);
    const node = new FunctionCallNode(R, 'UNKNOWN_FUNC', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeNull();
  });

  it('returns null when function argument is unresolvable', () => {
    const unknownVar = new VariableReferenceNode(R, 'missing');
    const node = new FunctionCallNode(R, 'ABS', unknownVar, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBeNull();
  });

  it('handles case-insensitive function names', () => {
    const argument = new LiteralExpressionNode(R, -5);
    const node = new FunctionCallNode(R, 'abs', argument, R);
    const evaluator = new GCodeExpressionEvaluator(new VariableEnvironment());
    expect(evaluator.evaluate(node)).toBe(5);
  });
});
