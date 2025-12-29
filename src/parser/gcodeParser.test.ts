import { readFileSync } from "node:fs";
import { GCodeParser } from "./gcodeParser";

describe("G-Code Parser", () => {
  const parser = new GCodeParser();

  test("parses simple G-code command", () => {
    const result = parser.parseGcode("G0");
    expect(result.type).toBe("Program");
    expect(result.body).toHaveLength(1);
    expect(result.body[0]).toEqual({
      type: "GCode",
      code: 0,
      params: {},
    });
  });

  test("parses G-code with parameters", () => {
    const result = parser.parseGcode("G0 X10 Y20 Z30");
    expect(result.type).toBe("Program");
    expect(result.body.length).toBeGreaterThan(0);
    // Check that GCode is present with at least some params
    const gcode = result.body.find(
      (stmt: any) => stmt.type === "GCode"
    );
    expect(gcode).toBeDefined();
    expect(gcode.code).toBe(0);
    expect(gcode.params).toHaveProperty("X");
  });

  test("parses M-code command", () => {
    const result = parser.parseGcode("M5\n");
    expect(result).toEqual({
      type: "Program",
      body: [
        {
          type: "MCode",
          code: 5,
          params: {},
        },
      ],
    });
  });

  test("parses multiple commands", () => {
    const result = parser.parseGcode("G0 X0\nM5\n");
    expect(result.type).toBe("Program");
    expect(result.body.length).toBe(2);
  });

  test("captures line numbers on statements", () => {
    const result = parser.parseGcode("N10 G1 X1\n");
    expect(result.body[0]).toEqual({
      type: "GCode",
      code: 1,
      params: { X: 1 },
      lineNumber: 10,
    });
  });

  test("parses standalone comments", () => {
    const result = parser.parseGcode("; program start\n");
    expect(result.body[0]).toEqual({
      type: "Comment",
      value: "program start",
    });
  });

  test("parses trailing comments on statements", () => {
    const result = parser.parseGcode("G0 X0 ; rapid move\n");
    expect(result.body[0]).toEqual({
      type: "GCode",
      code: 0,
      params: { X: 0 },
      comment: "rapid move",
    });
  });

  test("parses O-block declarations", () => {
    const result = parser.parseGcode("O1234\n");
    expect(result.body[0]).toEqual({
      type: "OBlock",
      id: 1234,
    });
  });

  test("parses variable assignment", () => {
    const result = parser.parseGcode("#1=10\n");
    expect(result.body[0]).toEqual({
      type: "Assign",
      variable: 1,
      value: { type: "Number", value: 10 },
    });
  });

  test("parses expression in parameter", () => {
    const result = parser.parseGcode("X[#1+10]\n");
    expect(result.body[0]).toEqual({
      type: "Param",
      params: {
        X: {
          type: "Binary",
          operator: "+",
          left: { type: "Variable", id: 1 },
          right: { type: "Number", value: 10 },
        },
      },
    });
  });

  test("parses real program", () => {
    const result = parser.parseGcode(`
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
    expect(result.type).toBe("Program");
    expect(result.body.length).toBe(19);
    expect(result.body[0]).toEqual({
      type: "GCode",
      code: 0,
      params: { X: 0, Y: 0, Z: 0 },
      lineNumber: 10,
    });
  });

  test("parses real file", () => {
    const parsed = parser.parseGcode(
      readFileSync(
        "src/parser/__tests__/fixtures/test1.nc",
        "utf8"
      ).toString()
    );
    expect(parsed).toEqual(
      JSON.parse(
        readFileSync(
          "src/parser/__tests__/fixtures/result1.json",
          "utf8"
        ).toString()
      )
    );
  });
});
