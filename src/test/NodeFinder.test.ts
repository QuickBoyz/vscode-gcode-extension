import { describe, expect, it } from '@jest/globals';

import { GCodeLexer } from '../lexer/GCodeLexer';
import { LinuxCNCParser } from '../parser/dialects/LinuxCNCParser';
import {
  BinaryExpressionNode,
  FunctionCallNode,
  MotionCommandNode,
  VariableAssignmentNode,
  VariableReferenceNode,
} from '../parser/nodes';
import { NodeFinder } from '../providers/NodeFinder';

describe('NodeFinder', () => {
  describe('calculateRangeSize', () => {
    it('should calculate size for single-line range', () => {
      const range = {
        start: { line: 0, character: 5 },
        end: { line: 0, character: 10 },
      };
      const size = NodeFinder.calculateRangeSize(range);
      expect(size).toBe(5); // 0 lines * 1000 + 5 chars
    });

    it('should calculate size for multi-line range', () => {
      const range = {
        start: { line: 0, character: 5 },
        end: { line: 2, character: 10 },
      };
      const size = NodeFinder.calculateRangeSize(range);
      expect(size).toBe(2 * NodeFinder.RANGE_SIZE_LINE_WEIGHT + 10);
    });

    it('should weight lines more heavily than characters', () => {
      const singleLine = {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 999 },
      };
      const multiLine = {
        start: { line: 0, character: 0 },
        end: { line: 1, character: 0 },
      };
      expect(NodeFinder.calculateRangeSize(multiLine)).toBeGreaterThan(
        NodeFinder.calculateRangeSize(singleLine)
      );
    });

    it('should handle zero-width range', () => {
      const range = {
        start: { line: 5, character: 10 },
        end: { line: 5, character: 10 },
      };
      const size = NodeFinder.calculateRangeSize(range);
      expect(size).toBe(0);
    });

    it('should handle large multi-line range', () => {
      const range = {
        start: { line: 0, character: 0 },
        end: { line: 100, character: 50 },
      };
      const size = NodeFinder.calculateRangeSize(range);
      expect(size).toBe(100 * NodeFinder.RANGE_SIZE_LINE_WEIGHT + 50);
    });
  });

  describe('findBestNodeAtPosition', () => {
    const parseCode = (code: string) => {
      const lexer = new GCodeLexer();
      const tokens = lexer.tokenize(code);
      const parser = new LinuxCNCParser(tokens, code);
      return parser.parseProgram();
    };

    it('should find variable assignment at position', () => {
      const program = parseCode('#<x> = 10');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 2 });

      expect(node).toBeInstanceOf(VariableAssignmentNode);
    });

    it('should find variable reference in expression', () => {
      const program = parseCode('#<result> = #<a> + #<b>');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 13 }); // Position on #<a>

      expect(node).toBeInstanceOf(VariableReferenceNode);
    });

    it('should find nested expression node', () => {
      const program = parseCode('#<result> = #<a> + #<b>');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 17 }); // Position on '+'

      expect(node).toBeInstanceOf(BinaryExpressionNode);
    });

    it('should prioritize operator range over expression', () => {
      const program = parseCode('IF [#<x> EQ 10] THEN\nENDIF');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 9 }); // Position on 'EQ'

      expect(node).toBeInstanceOf(BinaryExpressionNode);
      if (node instanceof BinaryExpressionNode) {
        expect(node.operator).toBe('EQ');
      }
    });

    it('should return smallest enclosing node', () => {
      const program = parseCode('#<x> = 10\n#<y> = 20');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 2 });

      // Should find variable assignment, not the entire program
      expect(node).toBeInstanceOf(VariableAssignmentNode);
      expect(node).not.toBeInstanceOf(program.constructor);
    });

    it('should return null for position outside any node', () => {
      const program = parseCode('#<x> = 10');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 10, character: 0 });

      expect(node).toBeNull();
    });

    it('should handle motion command with parameters', () => {
      const program = parseCode('G01 X10 Y20');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 1 }); // Position on 'G01'

      expect(node).toBeInstanceOf(MotionCommandNode);
    });

    it('should find function call', () => {
      const program = parseCode('#<result> = SIN[#<angle>]');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 13 }); // Position on 'SIN'

      expect(node).toBeInstanceOf(FunctionCallNode);
    });

    it('should find nodes in WHILE loop', () => {
      const program = parseCode('WHILE [#<i> LT 10] DO\n#<i> = #<i> + 1\nEND');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 8 }); // Position on condition

      expect(node).not.toBeNull();
      // Should find variable reference in condition
      expect(node).toBeInstanceOf(VariableReferenceNode);
    });

    it('should find nodes in IF statement body', () => {
      const program = parseCode('IF [#<x> GT 0] THEN\n#<y> = 10\nENDIF');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 1, character: 2 }); // Position in body

      expect(node).toBeInstanceOf(VariableAssignmentNode);
    });

    it('should handle unary expression', () => {
      const program = parseCode('#<x> = -5');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 7 }); // Position on '-'

      expect(node).not.toBeNull();
    });

    it('should find operator in complex expression', () => {
      const program = parseCode('#<result> = #<a> * #<b> + #<c>');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 17 }); // Position on '*'

      expect(node).toBeInstanceOf(BinaryExpressionNode);
      if (node instanceof BinaryExpressionNode) {
        expect(node.operator).toBe('*');
      }
    });

    it('should handle empty program', () => {
      const program = parseCode('');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 0 });

      expect(node).toBeNull();
    });

    it('should handle position at exact node boundary', () => {
      const program = parseCode('#<x> = 10');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 0 }); // Start of variable

      expect(node).toBeInstanceOf(VariableAssignmentNode);
    });

    it('should find nodes in ELSEIF clause', () => {
      const program = parseCode(
        'IF [#<x> EQ 1] THEN\n#<y> = 1\nELSEIF [#<x> EQ 2] THEN\n#<y> = 2\nENDIF'
      );
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 2, character: 8 }); // Position in ELSEIF condition

      expect(node).not.toBeNull();
      expect(node).toBeInstanceOf(VariableReferenceNode);
    });

    it('should find nodes in ELSE clause', () => {
      const program = parseCode('IF [#<x> EQ 1] THEN\n#<y> = 1\nELSE\n#<y> = 0\nENDIF');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 3, character: 2 }); // Position in ELSE body

      expect(node).toBeInstanceOf(VariableAssignmentNode);
    });

    it('should handle axis parameter in motion command', () => {
      const program = parseCode('G01 X[#<pos>]');
      const node = NodeFinder.findBestNodeAtPosition(program, { line: 0, character: 7 }); // Position on variable in param

      expect(node).toBeInstanceOf(VariableReferenceNode);
    });
  });
});
