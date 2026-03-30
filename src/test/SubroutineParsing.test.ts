import { DialectType } from '../constants';
import { LexerFactory } from '../lexer/LexerFactory';
import { ParserFactory } from '../parser/ParserFactory';
import {
  ErrorNode,
  MotionCommandNode,
  ProgramNode,
  ReturnStatementNode,
  SubroutineCallNode,
  SubroutineDefinitionNode,
  SubroutineLabelNode,
  VariableAssignmentNode,
} from '../parser/nodes';

describe('LinuxCNC subroutines', () => {
  function parse(input: string): ProgramNode {
    const lexer = LexerFactory.create(DialectType.LINUXCNC);
    const tokens = lexer.tokenize(input);
    const parser = ParserFactory.create(DialectType.LINUXCNC, tokens, input);
    return parser.parseProgram();
  }

  it('parses SUB/ENDSUB with body', () => {
    const code = `O100 SUB
G0 X10
O100 ENDSUB`;
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const node = program.statements[0];
    expect(node).toBeInstanceOf(SubroutineDefinitionNode);

    const sub = node as SubroutineDefinitionNode;
    expect(sub.label).toBe('O100');
    expect(sub.body.length).toBe(1);
    expect(sub.body[0]).toBeInstanceOf(MotionCommandNode);
  });

  it('parses SUB/ENDSUB with empty body', () => {
    const code = `O100 SUB
O100 ENDSUB`;
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const sub = program.statements[0] as SubroutineDefinitionNode;
    expect(sub).toBeInstanceOf(SubroutineDefinitionNode);
    expect(sub.label).toBe('O100');
    expect(sub.body.length).toBe(0);
  });

  it('parses SUB/ENDSUB with variable assignment and motion command', () => {
    const code = `O100 SUB
#<x> = 5
G1 X#<x>
O100 ENDSUB`;
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const sub = program.statements[0] as SubroutineDefinitionNode;
    expect(sub).toBeInstanceOf(SubroutineDefinitionNode);
    expect(sub.body.length).toBe(2);
    expect(sub.body[0]).toBeInstanceOf(VariableAssignmentNode);
    expect(sub.body[1]).toBeInstanceOf(MotionCommandNode);
  });

  it('parses CALL without arguments', () => {
    const code = 'O100 CALL';
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const node = program.statements[0];
    expect(node).toBeInstanceOf(SubroutineCallNode);

    const call = node as SubroutineCallNode;
    expect(call.target).toBe('O100');
    expect(call.callArguments.length).toBe(0);
  });

  it('parses CALL with bracket arguments', () => {
    const code = 'O100 CALL [5] [10]';
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const call = program.statements[0] as SubroutineCallNode;
    expect(call).toBeInstanceOf(SubroutineCallNode);
    expect(call.target).toBe('O100');
    expect(call.callArguments.length).toBe(2);
  });

  it('parses CALL with complex expression argument', () => {
    const code = 'O100 CALL [#<x> + 1]';
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const call = program.statements[0] as SubroutineCallNode;
    expect(call).toBeInstanceOf(SubroutineCallNode);
    expect(call.target).toBe('O100');
    expect(call.callArguments.length).toBe(1);
  });

  it('parses RETURN with label', () => {
    const code = 'O100 RETURN';
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const node = program.statements[0];
    expect(node).toBeInstanceOf(ReturnStatementNode);

    const ret = node as ReturnStatementNode;
    expect(ret.label).toBe('O100');
  });

  it('parses full program with SUB, CALL, RETURN, and other statements', () => {
    const code = `G0 X0 Y0
O100 SUB
  #<x> = 5
  G1 X#<x> F100
  O100 RETURN
O100 ENDSUB
O100 CALL [10] [20]
G0 X0 Y0`;
    const program = parse(code);

    expect(program.statements.length).toBe(4);
    expect(program.statements[0]).toBeInstanceOf(MotionCommandNode);
    expect(program.statements[1]).toBeInstanceOf(SubroutineDefinitionNode);

    const sub = program.statements[1] as SubroutineDefinitionNode;
    expect(sub.body.length).toBe(3);
    expect(sub.body[0]).toBeInstanceOf(VariableAssignmentNode);
    expect(sub.body[1]).toBeInstanceOf(MotionCommandNode);
    expect(sub.body[2]).toBeInstanceOf(ReturnStatementNode);

    expect(program.statements[2]).toBeInstanceOf(SubroutineCallNode);
    const call = program.statements[2] as SubroutineCallNode;
    expect(call.callArguments.length).toBe(2);

    expect(program.statements[3]).toBeInstanceOf(MotionCommandNode);
  });
});

describe('Fanuc/Haas subroutines', () => {
  function parseFanuc(input: string): ProgramNode {
    const lexer = LexerFactory.create(DialectType.FANUC);
    const tokens = lexer.tokenize(input);
    const parser = ParserFactory.create(DialectType.FANUC, tokens, input);
    return parser.parseProgram();
  }

  function parseHaas(input: string): ProgramNode {
    const lexer = LexerFactory.create(DialectType.HAAS);
    const tokens = lexer.tokenize(input);
    const parser = ParserFactory.create(DialectType.HAAS, tokens, input);
    return parser.parseProgram();
  }

  it('parses M98 P1000 as subroutine call with target', () => {
    const program = parseFanuc('M98 P1000');

    expect(program.statements.length).toBe(1);
    const call = program.statements[0] as SubroutineCallNode;
    expect(call).toBeInstanceOf(SubroutineCallNode);
    expect(call.target).toBe('1000');
    expect(call.callArguments.length).toBe(0);
    expect(call.repeatCount).toBeUndefined();
  });

  it('parses M98 P1000 L3 as subroutine call with repeat count', () => {
    const program = parseFanuc('M98 P1000 L3');

    expect(program.statements.length).toBe(1);
    const call = program.statements[0] as SubroutineCallNode;
    expect(call).toBeInstanceOf(SubroutineCallNode);
    expect(call.target).toBe('1000');
    expect(call.repeatCount).toBeDefined();
  });

  it('parses M99 as return statement', () => {
    const program = parseFanuc('M99');

    expect(program.statements.length).toBe(1);
    const ret = program.statements[0] as ReturnStatementNode;
    expect(ret).toBeInstanceOf(ReturnStatementNode);
    expect(ret.label).toBeUndefined();
  });

  it('parses M30 as regular motion command', () => {
    const program = parseFanuc('M30');

    expect(program.statements.length).toBe(1);
    expect(program.statements[0]).toBeInstanceOf(MotionCommandNode);
  });

  it('parses M98 without P parameter as error', () => {
    const program = parseFanuc('M98');

    expect(program.statements.length).toBe(1);
    expect(program.statements[0]).toBeInstanceOf(ErrorNode);
  });

  it('parses O0001 as SubroutineLabelNode', () => {
    const program = parseFanuc('O0001');

    expect(program.statements.length).toBe(1);
    expect(program.statements[0]).toBeInstanceOf(SubroutineLabelNode);
  });

  it('Haas parses M98 P1000 the same as Fanuc', () => {
    const program = parseHaas('M98 P1000');

    expect(program.statements.length).toBe(1);
    const call = program.statements[0] as SubroutineCallNode;
    expect(call).toBeInstanceOf(SubroutineCallNode);
    expect(call.target).toBe('1000');
  });
});

describe('Siemens subroutines', () => {
  function parse(input: string): ProgramNode {
    const lexer = LexerFactory.create(DialectType.SIEMENS);
    const tokens = lexer.tokenize(input);
    const parser = ParserFactory.create(DialectType.SIEMENS, tokens, input);
    return parser.parseProgram();
  }

  it('parses PROC/RET with body', () => {
    const code = `PROC MyProc
G0 X10
RET`;
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const node = program.statements[0];
    expect(node).toBeInstanceOf(SubroutineDefinitionNode);

    const sub = node as SubroutineDefinitionNode;
    expect(sub.label).toBe('MyProc');
    expect(sub.body.length).toBe(1);
    expect(sub.body[0]).toBeInstanceOf(MotionCommandNode);
  });

  it('parses PROC/RET with empty body', () => {
    const code = `PROC MyProc
RET`;
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const sub = program.statements[0] as SubroutineDefinitionNode;
    expect(sub).toBeInstanceOf(SubroutineDefinitionNode);
    expect(sub.label).toBe('MyProc');
    expect(sub.body.length).toBe(0);
  });

  it('parses CALL with procedure name', () => {
    const code = 'CALL MyProc';
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const call = program.statements[0] as SubroutineCallNode;
    expect(call).toBeInstanceOf(SubroutineCallNode);
    expect(call.target).toBe('MyProc');
    expect(call.callArguments.length).toBe(0);
  });

  it('parses standalone RET as return statement', () => {
    const code = 'RET';
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const ret = program.statements[0] as ReturnStatementNode;
    expect(ret).toBeInstanceOf(ReturnStatementNode);
    expect(ret.label).toBeUndefined();
  });

  it('parses RETURN as return statement', () => {
    const code = 'RETURN';
    const program = parse(code);

    expect(program.statements.length).toBe(1);
    const ret = program.statements[0] as ReturnStatementNode;
    expect(ret).toBeInstanceOf(ReturnStatementNode);
    expect(ret.label).toBeUndefined();
  });
});
