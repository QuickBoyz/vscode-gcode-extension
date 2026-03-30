import { DialectType } from '../../constants';
import { LexerFactory } from '../../lexer/LexerFactory';
import { ParserFactory } from '../../parser/ParserFactory';
import {
  CommentNode,
  IfStatementNode,
  LineNumberNode,
  MotionCommandNode,
  ProgramNode,
  VariableAssignmentNode,
  WhileStatementNode,
} from '../../parser/nodes';

describe('SiemensParser', () => {
  function parse(input: string): ProgramNode {
    const lexer = LexerFactory.create(DialectType.SIEMENS);
    const tokens = lexer.tokenize(input);
    const parser = ParserFactory.create(DialectType.SIEMENS, tokens, input);
    return parser.parseProgram();
  }

  describe('basic G-code parsing', () => {
    it('parses motion commands', () => {
      const program = parse('G0 X10 Y20');
      expect(program.statements.length).toBe(1);
      expect(program.statements[0]).toBeInstanceOf(MotionCommandNode);

      const command = program.statements[0] as MotionCommandNode;
      expect(command.command).toBe('G0');
      expect(command.getParameters().length).toBe(2);
    });

    it('parses semicolon comments', () => {
      const program = parse('; this is a comment');
      expect(program.statements.length).toBe(1);
      expect(program.statements[0]).toBeInstanceOf(CommentNode);
    });

    it('parses variable assignments', () => {
      const program = parse('#100 = 42');
      expect(program.statements.length).toBe(1);
      expect(program.statements[0]).toBeInstanceOf(VariableAssignmentNode);
    });

    it('parses line numbers', () => {
      const program = parse('N100 G0 X10');
      expect(program.statements.length).toBe(2);
      expect(program.statements[0]).toBeInstanceOf(LineNumberNode);
      expect(program.statements[1]).toBeInstanceOf(MotionCommandNode);
    });
  });

  describe('WHILE/ENDWHILE control flow', () => {
    it('parses WHILE/ENDWHILE without O-labels', () => {
      const code = `WHILE [#100 LT 10] DO
  #100 = [#100 + 1]
ENDWHILE`;
      const program = parse(code);
      expect(program.statements.length).toBe(1);

      const whileNode = program.statements[0] as WhileStatementNode;
      expect(whileNode).toBeInstanceOf(WhileStatementNode);
      expect(whileNode.condition).toBeDefined();
      expect(whileNode.body.length).toBe(1);
      expect(whileNode.body[0]).toBeInstanceOf(VariableAssignmentNode);
    });

    it('parses WHILE without DO keyword', () => {
      const code = `WHILE [#100 LT 10]
  #100 = [#100 + 1]
ENDWHILE`;
      const program = parse(code);
      expect(program.statements.length).toBe(1);
      expect(program.statements[0]).toBeInstanceOf(WhileStatementNode);
    });
  });

  describe('IF/ENDIF control flow', () => {
    it('parses IF/ENDIF without O-labels', () => {
      const code = `IF [#100 EQ 1] THEN
  G0 X10
ENDIF`;
      const program = parse(code);
      expect(program.statements.length).toBe(1);

      const ifNode = program.statements[0] as IfStatementNode;
      expect(ifNode).toBeInstanceOf(IfStatementNode);
      expect(ifNode.ifClause.condition).toBeDefined();
      expect(ifNode.ifClause.body.length).toBe(1);
    });

    it('parses IF/ELSE/ENDIF', () => {
      const code = `IF [#100 EQ 1] THEN
  G0 X10
ELSE
  G0 X20
ENDIF`;
      const program = parse(code);
      expect(program.statements.length).toBe(1);

      const ifNode = program.statements[0] as IfStatementNode;
      expect(ifNode).toBeInstanceOf(IfStatementNode);
      const elseClause = ifNode.elseClause;
      expect(elseClause).toBeDefined();
      expect(elseClause?.body.length).toBe(1);
    });

    it('parses IF/ELSEIF/ENDIF', () => {
      const code = `IF [#100 EQ 1] THEN
  G0 X10
ELSEIF [#100 EQ 2] THEN
  G0 X20
ENDIF`;
      const program = parse(code);
      expect(program.statements.length).toBe(1);

      const ifNode = program.statements[0] as IfStatementNode;
      expect(ifNode).toBeInstanceOf(IfStatementNode);
      const elseIfClauses = ifNode.elseIfClauses;
      expect(elseIfClauses).toBeDefined();
      expect(elseIfClauses?.length).toBe(1);
    });
  });
});
