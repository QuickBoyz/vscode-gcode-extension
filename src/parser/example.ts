/**
 * Example usage of the G-code parser
 */

import { GCodeParser } from "./gcodeParser";

// Example G-code program
const exampleGcode =
  "N10 G0 X0 Y0 Z0\n" +
  "N20 G1 X10 Y20 F100\n" +
  "N25 X[#1+10] Y[#2+20]\n" +
  "N30 M3 S1000\n" +
  "N40 G2 X[#<var>] Y30 I5 J5\n" +
  "N50 M5\n" +
  "N60 M30\n" +
  "N70 WHILE [#<var> LT 100] DO\n" +
  "N80 G1 X10 Y20 F100\n" +
  "N85 IF [#<var> EQ 100] THEN\n" +
  "N86 GOTO 100\n" +
  "N87 ELSEIF [#<var> EQ 200] THEN\n" +
  "N88 GOTO 200\n" +
  "N89 ELSE\n" +
  "N90 GOTO 300\n" +
  "N91 ENDIF\n" +
  "N92 GOTO 300\n" +
  "N93 END\n" +
  "N94 M30\n";

const parser = new GCodeParser();

try {
  console.log("Parsing G-code:");
  console.log(exampleGcode);
  console.log("\n---\n");

  const ast = parser.parseGcode(exampleGcode);
  console.log("Parsed AST:");
  console.log(JSON.stringify(ast, null, 2));
} catch (error: any) {
  console.error("Parse error:", error.message);
}
