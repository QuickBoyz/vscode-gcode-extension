import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DialectType } from '../constants';
import { LexerFactory } from '../lexer/LexerFactory';
import { ParserFactory } from '../parser/ParserFactory';
import { AstTraverser } from '../parser/AstTraverser';
import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import { ErrorNode, ProgramNode } from '../parser/nodes';

class ErrorCollector extends BaseAstVisitor<void> {
  readonly errors: ErrorNode[] = [];

  protected override defaultValue(): void {
    return;
  }

  override visitError(node: ErrorNode): void {
    this.errors.push(node);
  }
}

function parseLinuxCNC(code: string): ProgramNode {
  const lexer = LexerFactory.create(DialectType.LINUXCNC);
  const tokens = lexer.tokenize(code);
  const parser = ParserFactory.create(DialectType.LINUXCNC, tokens, code);
  return parser.parseProgram();
}

describe('real-world fixture parsing', () => {
  it('parses the LinuxCNC tool-change macro without diagnostics', () => {
    const code = readFileSync(join(__dirname, 'fixtures', 'tool-change-macro.ngc'), 'utf8');
    const program = parseLinuxCNC(code);
    const collector = new ErrorCollector();

    new AstTraverser(collector).traverseProgram(program);

    expect(collector.errors.map((error) => error.message)).toEqual([]);
  });
});
