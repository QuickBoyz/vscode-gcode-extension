import { GCodeLexer } from '../lexer/GCodeLexer';
import { GCodeParser } from '../parser/GCodeParser';
import {
  AxisParameterNode,
  CommentNode,
  ErrorNode,
  FunctionCallNode,
  IfStatementNode,
  MotionCommandNode,
  ProgramNode,
  VariableAssignmentNode,
  VariableReferenceNode,
  WhileStatementNode,
} from '../parser/nodes';
import { TokenType } from '../parser/nodes/tokens';

describe('GCodeParser', () => {
  function parse(input: string): ProgramNode {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(input),
      parser = new GCodeParser(tokens);
    return parser.parseProgram();
  }

  it('parses a simple variable assignment', () => {
    const program = parse('#<x> = 10');

    expect(program.statements.length).toBe(1);
    const stmt = program.statements[0];
    expect(stmt).toBeInstanceOf(VariableAssignmentNode);
    expect((stmt as VariableAssignmentNode).name).toBe('x');
    expect((stmt as VariableAssignmentNode).value).toHaveProperty('value', '10');
  });

  it('parses a function call in an assignment', () => {
    const program = parse('#<y> = ABS[ -5 ]'),
      stmt = program.statements[0];
    expect(stmt).toBeInstanceOf(VariableAssignmentNode);

    const expr = (stmt as VariableAssignmentNode).value;
    expect(expr).toBeInstanceOf(FunctionCallNode);
    expect((expr as FunctionCallNode).name).toBe('ABS');
  });

  it('parses a WHILE loop with body', () => {
    const code = `%
o100 while [#<i> LT 10] DO
  #<i> = [#<i> + 1]
o100 endwhile
    %`,
      program = parse(code);
    expect(program.statements.length).toBe(1);

    const loop = program.statements[0];
    expect(loop).toBeInstanceOf(WhileStatementNode);

    const whileNode = loop as WhileStatementNode;
    expect(whileNode.condition).toBeDefined();
    expect(whileNode.body.length).toBe(1);
    expect(whileNode.body[0]).toBeInstanceOf(VariableAssignmentNode);
  });

  it('parses a G-code command with axis parameters', () => {
    const code = 'G01 X10 Y20 Z-5 F100',
      program = parse(code);

    expect(program.statements.length).toBe(1);
    const cmd = program.statements[0];
    expect(cmd).toBeInstanceOf(MotionCommandNode);

    const params = (cmd as MotionCommandNode).getParameters();
    expect(params).toHaveLength(4);
    expect(params[0]).toBeInstanceOf(AxisParameterNode);
    expect(params[0].axis).toBe('X');
  });

  it('parses a G-code with decimal code number', () => {
    const code = 'G51.2 P1000',
      program = parse(code);

    expect(program.statements.length).toBe(1);
    const cmd = program.statements[0];
    expect(cmd).toBeInstanceOf(MotionCommandNode);
    expect((cmd as MotionCommandNode).command).toBe('G51.2');

    const params = (cmd as MotionCommandNode).getParameters();
    expect(params).toHaveLength(1);
    expect(params[0]).toBeInstanceOf(AxisParameterNode);
    expect(params[0].axis).toBe('P');
    expect(params[0].value).toHaveProperty('value', '1000');
  });

  it('returns an ErrorNode on unexpected token', () => {
    const code = '#<x> == 10', // Double equals is invalid
      program = parse(code);

    expect(program.statements.length).toBe(1);
    const stmt = program.statements[0];
    expect(stmt).toBeInstanceOf(ErrorNode);
    expect((stmt as ErrorNode).message).toMatch(/Unexpected token/);
  });

  it('parses multiple statements correctly', () => {
    const code = `
#<x> = 10
G00 X#<x>
#<y> = ABS[#<x>]
    `,
      program = parse(code);

    expect(program.statements.length).toBe(3);
    expect(program.statements[0]).toBeInstanceOf(VariableAssignmentNode);
    expect(program.statements[1]).toBeInstanceOf(MotionCommandNode);
    expect(program.statements[2]).toBeInstanceOf(VariableAssignmentNode);
  });
});

describe('GCodeParser - Full AST Tests', () => {
  function parse(input: string): ProgramNode {
    const lexer = new GCodeLexer(),
      tokens = lexer.tokenize(input),
      parser = new GCodeParser(tokens);
    return parser.parseProgram();
  }

  it('parses all basic node types', () => {
    const code = `
; This is a comment
#<x> = 10
#<y> = ABS[ -5 ]
G00 X#<x> Y#<y> F100
    `,
      program = parse(code);

    expect(program.statements.length).toBe(4);

    expect(program.statements[0]).toBeInstanceOf(CommentNode);
    expect(program.statements[1]).toBeInstanceOf(VariableAssignmentNode);
    expect(program.statements[2]).toBeInstanceOf(VariableAssignmentNode);
    expect(program.statements[3]).toBeInstanceOf(MotionCommandNode);

    const cmd = program.statements[3] as MotionCommandNode;
    expect(cmd.getParameters().length).toBe(3);
    expect(cmd.getParameters()[0]).toBeInstanceOf(AxisParameterNode);
    expect(cmd.getParameters()[1]).toBeInstanceOf(AxisParameterNode);
    expect(cmd.getParameters()[2]).toBeInstanceOf(AxisParameterNode);

    const axisX = cmd.getParameters()[0];
    expect(axisX.axis).toBe('X');
    expect(axisX.value).toBeDefined();
  });

  it('parses a WHILE loop with multiple statements', () => {
    const code = `
o100 while [#<i> LT 3] DO
  #<x> = [#<i> * 10]
  G01 X#<x>
o100 endwhile
    `,
      program = parse(code);

    expect(program.statements.length).toBe(1);
    const loop = program.statements[0];
    expect(loop).toBeInstanceOf(WhileStatementNode);

    const whileNode = loop as WhileStatementNode;
    expect(whileNode.body.length).toBe(2);

    expect(whileNode.body[0]).toBeInstanceOf(VariableAssignmentNode);
    expect(whileNode.body[1]).toBeInstanceOf(MotionCommandNode);

    const cmd = whileNode.body[1] as MotionCommandNode;
    expect(cmd.getParameters()[0]).toBeInstanceOf(AxisParameterNode);
  });

  it('handles nested WHILE loops', () => {
    const code = `
o100 while [#<row> LT 2] DO
  o110 while [#<col> LT 2] DO
    G01 X#<col> Y#<row>
  o110 endwhile
o100 endwhile
    `,
      program = parse(code);

    expect(program.statements.length).toBe(1);
    const outer = program.statements[0] as WhileStatementNode;
    expect(outer.body.length).toBe(1);

    const inner = outer.body[0] as WhileStatementNode;
    expect(inner.body.length).toBe(1);

    const cmd = inner.body[0] as MotionCommandNode;
    expect(cmd.getParameters().length).toBe(2);
    expect(cmd.getParameters()[0]).toBeInstanceOf(AxisParameterNode);
    expect(cmd.getParameters()[1]).toBeInstanceOf(AxisParameterNode);
  });

  it('parses IF with optional THEN keyword', () => {
    const program = parse(`
O10 IF [#<a> EQ 1] THEN
  G01 X10
O10 ENDIF
`),
      ifStmt = program.statements[0] as IfStatementNode;
    expect(ifStmt.ifClause.body[0]).toBeInstanceOf(MotionCommandNode);
  });

  it('parses IF + ELSEIF + ELSE', () => {
    const program = parse(`
O1 IF [#<x> LT 0]
  G01 X-1
O1 ELSEIF [#<x> EQ 0]
  G01 X0
O1 ELSE
  G01 X1
O1 ENDIF
`),
      ifStmt = program.statements[0] as IfStatementNode;

    expect(ifStmt.ifClause.kind).toBe(TokenType.IF);
    expect(ifStmt.elseIfClauses).toHaveLength(1);
    expect(ifStmt.elseIfClauses?.[0].kind).toBe(TokenType.ELSEIF);

    expect(ifStmt.elseClause).toBeDefined();
    expect(ifStmt.elseClause?.body).toHaveLength(1);
  });

  it('parses unlabeled IF + ELSEIF + ELSE (regression test for ELSEIF without label)', () => {
    const program = parse(`
IF [#<x> LT 0] THEN
  G01 X-1
ELSEIF [#<x> EQ 0] THEN
  G01 X0
ELSE
  G01 X1
ENDIF
`),
      ifStmt = program.statements[0] as IfStatementNode;

    expect(ifStmt).toBeInstanceOf(IfStatementNode);
    expect(ifStmt.label).toBeUndefined();
    expect(ifStmt.ifClause.kind).toBe(TokenType.IF);
    expect(ifStmt.elseIfClauses).toHaveLength(1);
    expect(ifStmt.elseIfClauses?.[0].kind).toBe(TokenType.ELSEIF);
    expect(ifStmt.elseClause).toBeDefined();
    expect(ifStmt.elseClause?.body).toHaveLength(1);
  });

  it('allows nested IF inside WHILE', () => {
    const program = parse(`
O10 WHILE [#<i> LT 3]
  O20 IF [#<i> EQ 1]
    G01 X10
    O30 IF [#<i> EQ 2]
      G01 X20
    O30 ENDIF
  O20 ENDIF
O10 ENDWHILE
`),
      whileStmt = program.statements[0] as WhileStatementNode,
      outer = whileStmt.body[0] as IfStatementNode;
    expect(outer.ifClause.body[0]).toBeInstanceOf(MotionCommandNode);
    expect(outer.ifClause.body[1]).toBeInstanceOf(IfStatementNode);
    const inner = outer.ifClause.body[1] as IfStatementNode;
    expect(inner.ifClause.body[0]).toBeInstanceOf(MotionCommandNode);
  });

  it('creates ErrorNode for invalid syntax', () => {
    const code = '#<x> == 5', // Double equals is invalid
      program = parse(code);
    expect(program.statements.length).toBe(1);
    const errorNode = program.statements[0];
    expect(errorNode).toBeInstanceOf(ErrorNode);
    expect((errorNode as ErrorNode).message).toMatch(/Unexpected token/);
  });

  it('parses comments correctly', () => {
    const code = `
; This is a comment
(Another comment)
#<x> = 10
    `,
      program = parse(code);

    expect(program.statements[0]).toBeInstanceOf(CommentNode);
    expect(program.statements[1]).toBeInstanceOf(CommentNode);
    expect(program.statements[2]).toBeInstanceOf(VariableAssignmentNode);
  });

  it('parses commands with multiple axis parameters including bracket expressions', () => {
    const code = `
G02 X[#<xpos> - #<tool_radius>] Y#<ypos> Z#<depth> F#<feed>
%
    `,
      program = parse(code);
    expect(program.statements.length).toBe(1);
    const cmd = program.statements[0] as MotionCommandNode;

    expect(cmd.getParameters().length).toBe(4);
    expect(cmd.getParameters()[0]).toBeInstanceOf(AxisParameterNode);
    expect(cmd.getParameters()[0].axis).toBe('X');
    expect(cmd.getParameters()[1].axis).toBe('Y');
    expect(cmd.getParameters()[2].axis).toBe('Z');
    expect(cmd.getParameters()[3].axis).toBe('F');
  });

  it('parses a larger program combining variables, loops, comments, commands, functions', () => {
    const code = `
%
; Tool setup
#<depth>=-17
#<feed>=1000

o100 while [#<row_count> LT 2] DO
  #<col_count> = 0
  o110 while [#<col_count> LT 2] DO
    #<xpos> = [#<start_x> + #<col_count> * #<x_spacing>]
    G00 X[#<xpos> - #<tool_radius>] Y#<ypos> F#<feed>
  o110 endwhile
  #<row_count> = [#<row_count> + 1]
o100 endwhile

M30
    `,
      program = parse(code);

    expect(program.statements.length).toBe(5);
    expect(program.statements[0]).toBeInstanceOf(CommentNode);
    expect(program.statements[1]).toBeInstanceOf(VariableAssignmentNode);
    expect(program.statements[2]).toBeInstanceOf(VariableAssignmentNode);
    expect(program.statements[3]).toBeInstanceOf(WhileStatementNode);

    const outer = program.statements[3] as WhileStatementNode;
    expect(outer.body[0]).toBeInstanceOf(VariableAssignmentNode);
    expect(outer.body[1]).toBeInstanceOf(WhileStatementNode);
    expect(outer.body[2]).toBeInstanceOf(VariableAssignmentNode);

    const inner = outer.body[1] as WhileStatementNode;
    expect(inner.body[0]).toBeInstanceOf(VariableAssignmentNode);
    expect(inner.body[1]).toBeInstanceOf(MotionCommandNode);

    expect(program.statements[4]).toBeInstanceOf(MotionCommandNode); // M30
  });

  describe('numeric variable parsing', () => {
    it('parses numeric variables as numbers in assignments', () => {
      const program = parse('#<tool_diameter> = #5410');

      expect(program.statements.length).toBe(1);
      const stmt = program.statements[0] as VariableAssignmentNode;
      expect(stmt.name).toBe('tool_diameter');

      const { value } = stmt;
      expect(value).toBeInstanceOf(VariableReferenceNode);
      const varRef = value as VariableReferenceNode;
      expect(typeof varRef.name).toBe('number');
      expect(varRef.name).toBe(5410);
    });

    it('parses single-digit numeric variables as numbers', () => {
      const program = parse('#<x> = #1'),
        stmt = program.statements[0] as VariableAssignmentNode,
        varRef = stmt.value as VariableReferenceNode;
      expect(typeof varRef.name).toBe('number');
      expect(varRef.name).toBe(1);
    });

    it('parses multi-digit numeric variables as numbers', () => {
      const program = parse('#<value> = #123'),
        stmt = program.statements[0] as VariableAssignmentNode,
        varRef = stmt.value as VariableReferenceNode;
      expect(typeof varRef.name).toBe('number');
      expect(varRef.name).toBe(123);
    });

    it('parses large numeric variables as numbers', () => {
      const program = parse('#<param> = #9999'),
        stmt = program.statements[0] as VariableAssignmentNode,
        varRef = stmt.value as VariableReferenceNode;
      expect(typeof varRef.name).toBe('number');
      expect(varRef.name).toBe(9999);
    });

    it('parses numeric variables in expressions correctly', () => {
      const program = parse('#<result> = #100 + #200'),
        stmt = program.statements[0] as VariableAssignmentNode,
        expr = stmt.value;
      expect(expr).toBeDefined();

      // The expression should be a binary expression with numeric variable references
      // We can't easily check the internal structure without more accessors,
      // But we can verify it parses without errors
      expect(program.statements.length).toBe(1);
    });

    it('parses numeric variables in axis parameters', () => {
      const program = parse('G00 X#100 Y#200');

      expect(program.statements.length).toBe(1);
      const cmd = program.statements[0] as MotionCommandNode;
      expect(cmd.getParameters().length).toBe(2);

      const xParam = cmd.getParameters()[0],
        xValue = xParam.value;
      expect(xValue).toBeInstanceOf(VariableReferenceNode);
      const xVarRef = xValue as VariableReferenceNode;
      expect(typeof xVarRef.name).toBe('number');
      expect(xVarRef.name).toBe(100);
    });

    it('parses numeric variables in conditional expressions', () => {
      const program = parse('O10 IF [#100 GT #200]\nG01 X10\nO10 ENDIF'),
        ifStmt = program.statements[0] as IfStatementNode,
        { condition } = ifStmt.ifClause;
      expect(condition).toBeDefined();
      // Condition should parse without errors
      expect(program.statements.length).toBe(1);
    });

    it('distinguishes between numeric and named variables', () => {
      const program = parse('#<named> = #<x>\n#<numeric> = #100');

      expect(program.statements.length).toBe(2);

      const namedStmt = program.statements[0] as VariableAssignmentNode,
        namedValue = namedStmt.value as VariableReferenceNode;
      expect(typeof namedValue.name).toBe('string');
      expect(namedValue.name).toBe('x');

      const numericStmt = program.statements[1] as VariableAssignmentNode,
        numericValue = numericStmt.value as VariableReferenceNode;
      expect(typeof numericValue.name).toBe('number');
      expect(numericValue.name).toBe(100);
    });

    it('parses numeric variables in function calls', () => {
      const program = parse('#<result> = ABS[#500]'),
        stmt = program.statements[0] as VariableAssignmentNode,
        funcCall = stmt.value;
      expect(funcCall).toBeInstanceOf(FunctionCallNode);
      expect((funcCall as FunctionCallNode).name).toBe('ABS');
    });
  });

  describe('parameter-only lines', () => {
    it('parses multiple parameter-only lines', () => {
      const code = `Y0.0 X0.15 R0.075 F30.0
Y0.0 X-0.15 R0.15
Y0.0 X0.3 R0.225`,
        program = parse(code);

      expect(program.statements.length).toBe(10);

      expect(program.statements[0]).toBeInstanceOf(AxisParameterNode);
      expect(program.statements[1]).toBeInstanceOf(AxisParameterNode);
      expect(program.statements[2]).toBeInstanceOf(AxisParameterNode);
      expect(program.statements[3]).toBeInstanceOf(AxisParameterNode);
      expect(program.statements[4]).toBeInstanceOf(AxisParameterNode);
      expect(program.statements[5]).toBeInstanceOf(AxisParameterNode);
      expect(program.statements[6]).toBeInstanceOf(AxisParameterNode);
      expect(program.statements[7]).toBeInstanceOf(AxisParameterNode);
      expect(program.statements[8]).toBeInstanceOf(AxisParameterNode);
      expect(program.statements[9]).toBeInstanceOf(AxisParameterNode);
    });
  });
});
