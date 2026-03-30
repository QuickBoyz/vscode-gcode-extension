import { DialectType } from '../../constants';
import { LexerFactory } from '../../lexer/LexerFactory';
import { ParserFactory } from '../../parser/ParserFactory';
import {
  CommentNode,
  LineNumberNode,
  MotionCommandNode,
  ProgramNode,
  VariableAssignmentNode,
} from '../../parser/nodes';

describe('HaasParser', () => {
  function parse(input: string): ProgramNode {
    const lexer = LexerFactory.create(DialectType.HAAS);
    const tokens = lexer.tokenize(input);
    const parser = ParserFactory.create(DialectType.HAAS, tokens, input);
    return parser.parseProgram();
  }

  function parseFanuc(input: string): ProgramNode {
    const lexer = LexerFactory.create(DialectType.FANUC);
    const tokens = lexer.tokenize(input);
    const parser = ParserFactory.create(DialectType.FANUC, tokens, input);
    return parser.parseProgram();
  }

  describe('parses identically to FanucParser', () => {
    it('parses motion commands the same as Fanuc', () => {
      const input = 'G0 X10 Y20 Z5';
      const haasProgram = parse(input);
      const fanucProgram = parseFanuc(input);

      expect(haasProgram.statements.length).toBe(fanucProgram.statements.length);
      expect(haasProgram.statements[0]).toBeInstanceOf(MotionCommandNode);

      const haasCommand = haasProgram.statements[0] as MotionCommandNode;
      const fanucCommand = fanucProgram.statements[0] as MotionCommandNode;
      expect(haasCommand.command).toBe(fanucCommand.command);
      expect(haasCommand.getParameters().length).toBe(fanucCommand.getParameters().length);
    });

    it('parses comments the same as Fanuc', () => {
      const input = '; this is a comment';
      const haasProgram = parse(input);
      const fanucProgram = parseFanuc(input);

      expect(haasProgram.statements.length).toBe(fanucProgram.statements.length);
      expect(haasProgram.statements[0]).toBeInstanceOf(CommentNode);
      expect(fanucProgram.statements[0]).toBeInstanceOf(CommentNode);
    });

    it('parses variable assignments the same as Fanuc', () => {
      const input = '#100 = 42';
      const haasProgram = parse(input);
      const fanucProgram = parseFanuc(input);

      expect(haasProgram.statements.length).toBe(fanucProgram.statements.length);
      expect(haasProgram.statements[0]).toBeInstanceOf(VariableAssignmentNode);
      expect(fanucProgram.statements[0]).toBeInstanceOf(VariableAssignmentNode);
    });

    it('parses line numbers the same as Fanuc', () => {
      const input = 'N100 G0 X10';
      const haasProgram = parse(input);
      const fanucProgram = parseFanuc(input);

      expect(haasProgram.statements.length).toBe(fanucProgram.statements.length);
      expect(haasProgram.statements[0]).toBeInstanceOf(LineNumberNode);
      expect(haasProgram.statements[1]).toBeInstanceOf(MotionCommandNode);
    });

    it('parses multi-line programs the same as Fanuc', () => {
      const input = `G0 X10 Y20
G1 Z-5 F100
M3 S1000`;
      const haasProgram = parse(input);
      const fanucProgram = parseFanuc(input);

      expect(haasProgram.statements.length).toBe(fanucProgram.statements.length);
      expect(haasProgram.statements.length).toBe(3);
    });
  });
});
