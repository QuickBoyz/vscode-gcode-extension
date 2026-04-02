/**
 * ErrorDetectorVisitor Unit Tests
 *
 * Tests that the error detector correctly distinguishes between
 * error-category and non-error-category ErrorNodes.
 */
import { describe, expect, it } from '@jest/globals';

import { ErrorDetectorVisitor } from '../providers/ErrorDetectorVisitor';
import { DiagnosticCategory, ErrorNode, ProgramNode } from '../parser/nodes';

function createErrorNode(category: DiagnosticCategory, message: string = 'test'): ErrorNode {
  return new ErrorNode(
    { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
    message,
    undefined,
    undefined,
    category
  );
}

describe('ErrorDetectorVisitor', () => {
  it('should return true when program has Error-category nodes', () => {
    const errorNode = createErrorNode(DiagnosticCategory.Error);
    const program = new ProgramNode([errorNode], false, false);
    const detector = new ErrorDetectorVisitor();

    expect(detector.hasErrors(program)).toBe(true);
  });

  it('should return false when program has only Warning-category nodes', () => {
    const warningNode = createErrorNode(DiagnosticCategory.Warning);
    const program = new ProgramNode([warningNode], false, false);
    const detector = new ErrorDetectorVisitor();

    expect(detector.hasErrors(program)).toBe(false);
  });

  it('should return false when program has only Information-category nodes', () => {
    const infoNode = createErrorNode(DiagnosticCategory.Information);
    const program = new ProgramNode([infoNode], false, false);
    const detector = new ErrorDetectorVisitor();

    expect(detector.hasErrors(program)).toBe(false);
  });

  it('should return false when program has only Hint-category nodes', () => {
    const hintNode = createErrorNode(DiagnosticCategory.Hint);
    const program = new ProgramNode([hintNode], false, false);
    const detector = new ErrorDetectorVisitor();

    expect(detector.hasErrors(program)).toBe(false);
  });

  it('should return true when program has mixed categories including Error', () => {
    const warningNode = createErrorNode(DiagnosticCategory.Warning);
    const errorNode = createErrorNode(DiagnosticCategory.Error);
    const program = new ProgramNode([warningNode, errorNode], false, false);
    const detector = new ErrorDetectorVisitor();

    expect(detector.hasErrors(program)).toBe(true);
  });

  it('should return false when program has no error nodes', () => {
    const program = new ProgramNode([], false, false);
    const detector = new ErrorDetectorVisitor();

    expect(detector.hasErrors(program)).toBe(false);
  });
});
