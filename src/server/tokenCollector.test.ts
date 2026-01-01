/**
 * Tests for Token Collector
 */
import { SemanticToken, TokenCollector } from "./tokenCollector";
import { VariableTracker } from "./variableTracker";
import { gcodeParser } from "../parser";
import { TextDocument } from "vscode-languageserver-textdocument";

describe("TokenCollector", () => {
  const variableTracker = new VariableTracker();
  const collector = new TokenCollector(variableTracker);

  describe("collectTokens", () => {
    it("should collect semantic tokens for G-codes", () => {
      const text = "G21 G90 G54 G17";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      expect(tokens.length).toBeGreaterThan(0);

      // Check that G-codes are marked as "function" type
      const gCodeTokens = tokens.filter(
        (t) =>
          t.tokenType === "function" &&
          /^G\d+/i.test(getTokenText(t, text))
      );
      expect(gCodeTokens.length).toBeGreaterThanOrEqual(4); // G21, G90, G54, G17
    });

    it("should collect semantic tokens for M-codes", () => {
      const text = "M3 S1000\nM5\nM30";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      const mCodeTokens = tokens.filter(
        (t) =>
          t.tokenType === "function" &&
          /^M\d+/i.test(getTokenText(t, text))
      );
      expect(mCodeTokens.length).toBeGreaterThanOrEqual(3); // M3, M5, M30
    });

    it("should collect semantic tokens for variables with declaration modifier", () => {
      const text = "#1=10\n#2=20\nG0 X#1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      // Check for variable declarations
      const declarations = tokens.filter(
        (t) =>
          t.tokenType === "variable" &&
          t.modifiers.includes("declaration")
      );
      expect(declarations.length).toBe(2); // #1 and #2 declarations

      // Check for variable usages
      const usages = tokens.filter(
        (t) =>
          t.tokenType === "variable" &&
          !t.modifiers.includes("declaration")
      );
      expect(usages.length).toBe(1); // #1 usage in X#1
    });

    it("should collect semantic tokens for O-blocks", () => {
      const text = "O100\nG0 X0\nO200\nG1 X10";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      const oBlockTokens = tokens.filter(
        (t) => t.tokenType === "label"
      );
      expect(oBlockTokens.length).toBe(2); // O100 and O200
    });

    it("should collect semantic tokens for keywords", () => {
      const text = "WHILE [#1 LT 10] DO 1\nG0 X#1\nEND 1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      const keywordTokens = tokens.filter(
        (t) => t.tokenType === "keyword"
      );
      expect(keywordTokens.length).toBeGreaterThanOrEqual(2); // WHILE and END (DO might be separate)
    });

    it("should collect semantic tokens for operators", () => {
      const text = "#1=10\n#2=#1+5\n#3=#2*2";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      const operatorTokens = tokens.filter(
        (t) => t.tokenType === "operator"
      );
      expect(operatorTokens.length).toBeGreaterThanOrEqual(3); // =, +, *
    });

    it("should collect semantic tokens for numbers", () => {
      const text = "G0 X10.5 Y-5 Z0";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      const numberTokens = tokens.filter(
        (t) => t.tokenType === "number"
      );
      expect(numberTokens.length).toBeGreaterThanOrEqual(3); // 10.5, -5, 0
    });

    it("should collect semantic tokens for built-in functions", () => {
      const text = "#1=SIN[30]\n#2=COS[45]";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      const functionTokens = tokens.filter(
        (t) => t.tokenType === "function"
      );
      expect(functionTokens.length).toBeGreaterThanOrEqual(2); // SIN and COS
    });

    it("should collect semantic tokens for comments", () => {
      const text =
        "G0 X0 (This is a comment)\nG1 X10 ; Another comment";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      const commentTokens = tokens.filter(
        (t) => t.tokenType === "comment"
      );
      expect(commentTokens.length).toBe(2); // Both comments
    });

    it("should handle complex G-code file with all token types", () => {
      const text = `
O100
#1=10
#2=SIN[30]
WHILE [#1 LT 100] DO 1
  G0 X#1 Y#2
  #1=#1+1
END 1
M30
`;
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      expect(tokens.length).toBeGreaterThan(0);

      // Check for various token types - be more flexible about what's present
      const tokenTypes = tokens.map((t) => t.tokenType);
      const uniqueTokenTypes = [...new Set(tokenTypes)];

      // The test data should produce at least these token types
      expect(uniqueTokenTypes).toContain("label"); // O100
      expect(uniqueTokenTypes).toContain("variable"); // #1, #2
      expect(uniqueTokenTypes).toContain("number"); // 10, 30, etc.
    });

    it("should mark G-codes as function tokens", () => {
      const text = "G21 G90 G54";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const tokens = collector.collectTokens(ast, document);

      const functionTokens = tokens.filter(
        (t) => t.tokenType === "function"
      );
      expect(functionTokens.length).toBe(3); // G21, G90, G54
    });
  });
});

/**
 * Helper function to get token text from document
 */
function getTokenText(
  token: SemanticToken,
  documentText: string
): string {
  const lines = documentText.split(/\r?\n/);
  const line = lines[token.line];
  if (!line) return "";
  return line.slice(token.character, token.character + token.length);
}
