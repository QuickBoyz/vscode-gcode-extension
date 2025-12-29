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
      type: "ParamUpdate",
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
});
