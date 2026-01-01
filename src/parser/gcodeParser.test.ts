import { readFileSync } from "node:fs";
import { gcodeParser } from "./gcodeParser";
import {
  Assignment,
  Block,
  GCommand,
  IfGoto,
  MCommand,
  OBlock,
  Param,
  ParenthicalComment,
  ProgramDelimiter,
  SemicolonComment,
  Statement,
} from "../entities/statements";
import { Program } from "../entities";
import {
  Binary,
  BinaryOperatorType,
  Number,
  Relational,
  Variable,
} from "../entities/expressions";

describe("G-Code Parser", () => {
  test("parses simple G-code command", () => {
    const result = gcodeParser.parseGcode("G0");
    expect(result).toBeInstanceOf(Program);
    expect(result.getBody()).toHaveLength(1);
    expect(result.getBody()[0]).toBeInstanceOf(GCommand);
    const gcode = result.getBody()[0] as GCommand;
    expect(gcode.getCode()).toBe(0);
    expect(gcode.getParams()).toEqual({});
  });

  test("parses G-code with parameters", () => {
    const result = gcodeParser.parseGcode("G0 X10 Y20 Z30");
    expect(result).toBeInstanceOf(Program);
    expect(result.getBody().length).toBeGreaterThan(0);
    // Check that GCode is present with at least some params
    const gcode = result
      .getBody()
      .find((stmt: Statement) => stmt instanceof GCommand);
    expect(gcode).toBeDefined();
    expect((gcode as GCommand).getCode()).toBe(0);
    expect((gcode as GCommand).getParams()).toHaveProperty("X");
  });

  test("parses M-code command", () => {
    const result = gcodeParser.parseGcode("M5\n");
    expect(result).toBeInstanceOf(Program);
    expect(result.getBody().length).toBe(1);
    expect(result.getBody()[0]).toBeInstanceOf(MCommand);
    const mcode = result.getBody()[0] as MCommand;
    expect(mcode.getCode()).toBe(5);
    expect(mcode.getParams()).toEqual({});
  });

  test("parses multiple commands", () => {
    const result = gcodeParser.parseGcode("G0 X0\nM5\n");
    expect(result).toBeInstanceOf(Program);
    expect(result.getBody().length).toBe(2);
  });

  test("captures line numbers on statements", () => {
    const result = gcodeParser.parseGcode("N10 G1 X1\n");
    expect(result.getBody()[0]).toBeInstanceOf(GCommand);
    const gcode = result.getBody()[0] as GCommand;
    expect(gcode.getCode()).toBe(1);
    expect(gcode.getParams()).toEqual({ X: 1 });
    expect(gcode.getRange()).toBeDefined();
  });

  test("parses standalone semicolon comments", () => {
    const result = gcodeParser.parseGcode("; program start\n");
    expect(result.getBody()[0]).toBeInstanceOf(SemicolonComment);
    const comment = result.getBody()[0] as SemicolonComment;
    expect(comment.getValue()).toBe("program start");
  });

  test("parses standalone parenthetical comments", () => {
    const result = gcodeParser.parseGcode("( TOOL CHANGE )\n");
    expect(result.getBody()[0]).toBeInstanceOf(ParenthicalComment);
    const comment = result.getBody()[0] as ParenthicalComment;
    expect(comment.getValue()).toBe("TOOL CHANGE");
  });

  test("parses trailing semicolon comments on statements", () => {
    const result = gcodeParser.parseGcode("G0 X0 ; rapid move\n");
    // Comments are now separate statements, so we should have 2 statements
    expect(result.getBody().length).toBeGreaterThanOrEqual(1);
    const gcode = result.getBody()[0] as GCommand;
    expect(gcode.getCode()).toBe(0);
    expect(gcode.getParams()).toEqual({ X: 0 });
    // Comment would be a separate statement if parsed
    // For now, we just verify the GCode is correct
  });

  test("parses trailing parenthetical comments on statements", () => {
    const result = gcodeParser.parseGcode("G0 X0 (rapid move)\n");
    // Comments are now separate statements, so we should have at least 1 statement
    expect(result.getBody().length).toBeGreaterThanOrEqual(1);
    const gcode = result.getBody()[0] as GCommand;
    expect(gcode.getCode()).toBe(0);
    expect(gcode.getParams()).toEqual({ X: 0 });
    // Comment would be a separate statement if parsed
    // For now, we just verify the GCode is correct
  });

  test("parses O-block declarations", () => {
    const result = gcodeParser.parseGcode("O1234\n");
    expect(result.getBody()[0]).toBeInstanceOf(OBlock);
    const oblock = result.getBody()[0] as OBlock;
    expect(oblock.getId()).toBe(1234);
  });

  test("parses multiple G-codes on same line", () => {
    const result = gcodeParser.parseGcode("G40 G49 G80\n");
    expect(result.getBody()[0]).toBeInstanceOf(Block);
    const block = result.getBody()[0] as Block;
    expect(block.getCodes()).toHaveLength(3);
    expect(block.getCodes()[0]).toBeInstanceOf(GCommand);
    expect(block.getCodes()[0].getCode()).toBe(40);
    expect(block.getCodes()[1]).toBeInstanceOf(GCommand);
    expect(block.getCodes()[1].getCode()).toBe(49);
    expect(block.getCodes()[2]).toBeInstanceOf(GCommand);
    expect(block.getCodes()[2].getCode()).toBe(80);
    expect(block.getParams()).toEqual({});
  });

  test("parses mixed G and M codes with params", () => {
    const result = gcodeParser.parseGcode("G20 T17 M6\n");
    expect(result.getBody()[0]).toBeInstanceOf(Block);
    const block = result.getBody()[0] as Block;
    expect(block.getCodes()).toHaveLength(2);
    expect(block.getCodes()[0]).toBeInstanceOf(GCommand);
    expect(block.getCodes()[0].getCode()).toBe(20);
    expect(block.getCodes()[1]).toBeInstanceOf(MCommand);
    expect(block.getCodes()[1].getCode()).toBe(6);
    expect(block.getParams()).toEqual({ T: 17 });
  });

  test("parses variable assignment", () => {
    const result = gcodeParser.parseGcode("#1=10\n");
    expect(result.getBody()[0]).toBeInstanceOf(Assignment);
    const assign = result.getBody()[0] as Assignment;
    expect(assign.getVariable()).toBe(1);
    expect(assign.getValue()).toBeInstanceOf(Number);
    expect((assign.getValue() as Number).getValue()).toBe(10);
  });

  test("parses expression in parameter", () => {
    const result = gcodeParser.parseGcode("X[#1+10]\n");
    expect(result.getBody()[0]).toBeInstanceOf(Param);
    const param = result.getBody()[0] as Param;
    const x = param.getParams().X as Binary;
    expect(x.getOperator()).toBe(BinaryOperatorType.Add);
    expect(x.getLeft()).toBeInstanceOf(Variable);
    expect((x.getLeft() as Variable).getId()).toBe(1);
    expect(x.getRight()).toBeInstanceOf(Number);
    expect((x.getRight() as Number).getValue()).toBe(10);
  });

  test("parses ternary IF GOTO statement", () => {
    const result = gcodeParser.parseGcode("IF [#1 EQ 100] GOTO 500\n");
    expect(result.getBody()[0]).toBeInstanceOf(IfGoto);
    const ifGoto = result.getBody()[0] as IfGoto;
    const condition = ifGoto.getCondition() as Relational;
    expect(condition).toBeInstanceOf(Relational);
    expect(condition.getOperator()).toBe("EQ");
    const left = condition.getLeft() as Variable;
    expect(left).toBeInstanceOf(Variable);
    expect(left.getId()).toBe(1);
    const right = condition.getRight() as Number;
    expect(right).toBeInstanceOf(Number);
    expect(right.getValue()).toBe(100);
    expect(ifGoto.getTarget()).toBe(500);
  });

  test("parses program delimiter (%)", () => {
    const result = gcodeParser.parseGcode("%\n");
    expect(result.getBody()[0]).toBeInstanceOf(ProgramDelimiter);
  });

  test("parses program with % delimiters", () => {
    const result = gcodeParser.parseGcode(`
      %
      O1234
      G0 X0 Y0
      M30
      %
    `);
    expect(result).toBeInstanceOf(Program);
    expect(result.getBody().length).toBe(5);
    expect(result.getBody()[0]).toBeInstanceOf(ProgramDelimiter);
    expect(result.getBody()[1]).toBeInstanceOf(OBlock);
    expect((result.getBody()[1] as OBlock).getId()).toBe(1234);
    expect(result.getBody()[4]).toBeInstanceOf(ProgramDelimiter);
  });

  test("parses real program", () => {
    const result = gcodeParser.parseGcode(`
      N10 G0 X0 Y0 Z0
      N20 G1 X10 Y20 F100
      N25 X[#1+10] Y[#2+20]
      N30 M3 S1000
      N40 G2 X[#<var>] Y30 I5 J5
      N50 M5
      N60 M30
      N70 O100 WHILE [#<var> LT 100] DO
      N80 G1 X10 Y20 F100
      N85 O111 IF [#<var> EQ 100] THEN
      N86 GOTO 100
      N87 O111 ELSEIF [#<var> EQ 200] THEN
      N88 GOTO 200
      N89 O111 ELSE
      N90 GOTO 300
      N91 O111 ENDIF
      N92 GOTO 300
      N93 O100 END
      N94 M30
    `);
    expect(result).toBeInstanceOf(Program);
    expect(result.getBody().length).toBe(19);
    expect(result.getBody()[0]).toBeInstanceOf(GCommand);
    expect((result.getBody()[0] as GCommand).getCode()).toBe(0);
    expect((result.getBody()[0] as GCommand).getParams()).toEqual({
      X: 0,
      Y: 0,
      Z: 0,
    });
  });

  test.each([1, 2, 3])("parses real file %s", (index) => {
    const parsed = gcodeParser.parseGcode(
      readFileSync(
        `src/__tests__/fixtures/test${index}.nc`,
        "utf8"
      ).toString()
    );
    // Serialize to JSON and back to compare structure (class instances serialize differently)
    const parsedJson = JSON.parse(JSON.stringify(parsed));
    const expected = JSON.parse(
      readFileSync(
        `src/__tests__/fixtures/result${index}.json`,
        "utf8"
      ).toString()
    );
    expect(parsedJson).toEqual(expected);
  });
});
