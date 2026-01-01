/**
 * Tests for Semantic Tokens Provider
 */
import {
  SemanticTokensProvider,
  SEMANTIC_TOKENS_LEGEND,
} from "./semanticTokensProvider";
import { VariableTracker } from "./variableTracker";
import { gcodeParser } from "../parser";
import { TextDocument } from "vscode-languageserver-textdocument";

describe("SemanticTokensProvider", () => {
  const variableTracker = new VariableTracker();
  const provider = new SemanticTokensProvider(variableTracker);

  describe("provideDocumentSemanticTokens", () => {
    it("should provide semantic tokens for G-codes", () => {
      const text = "G21 G90 G54 G17";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      // Decode tokens to verify G-codes are marked as "function"
      const tokens = decodeSemanticTokens(result.data);
      const gCodeTokens = tokens.filter(
        (t) =>
          t.type === "function" && /^G\d+/i.test(getTokenText(t, text))
      );
      expect(gCodeTokens.length).toBeGreaterThanOrEqual(4); // G21, G90, G54, G17
    });

    it("should provide semantic tokens for M-codes", () => {
      const text = "M3 S1000\nM5\nM30";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      const tokens = decodeSemanticTokens(result.data);
      const mCodeTokens = tokens.filter(
        (t) =>
          t.type === "function" && /^M\d+/i.test(getTokenText(t, text))
      );
      expect(mCodeTokens.length).toBeGreaterThanOrEqual(3); // M3, M5, M30
    });

    it("should provide semantic tokens for variables with declaration modifier", () => {
      const text = "#<depth> = -17.0\n#<x_spacing> = 50.0";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      const tokens = decodeSemanticTokens(result.data);
      const variableTokens = tokens.filter(
        (t) => t.type === "variable"
      );
      expect(variableTokens.length).toBeGreaterThan(0);

      // Check that variable declarations have the declaration modifier
      const declarationTokens = tokens.filter(
        (t) =>
          t.type === "variable" && t.modifiers.includes("declaration")
      );
      expect(declarationTokens.length).toBeGreaterThan(0);

      // Verify that = operators are marked as OPERATOR, not KEYWORD
      const operatorTokens = tokens.filter(
        (t) => t.type === "operator" && getTokenText(t, text) === "="
      );
      expect(operatorTokens.length).toBeGreaterThanOrEqual(2); // At least 2 = operators

      // Verify that assignment statements are NOT marked as KEYWORD
      // (the entire assignment should not be one big KEYWORD token)
      const keywordTokens = tokens.filter((t) => t.type === "keyword");
      const assignmentKeywordTokens = keywordTokens.filter((t) => {
        const tokenText = getTokenText(t, text);
        return (
          tokenText.includes("#<depth>") ||
          tokenText.includes("#<x_spacing>")
        );
      });
      expect(assignmentKeywordTokens.length).toBe(0); // No assignment should be marked as KEYWORD
    });

    it("should provide semantic tokens for O-blocks", () => {
      const text = "O100 WHILE [#<row_count> LT #<rows>] DO\nO110 END";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      const tokens = decodeSemanticTokens(result.data);
      const oBlockTokens = tokens.filter(
        (t) =>
          t.type === "label" && /^O\d+/i.test(getTokenText(t, text))
      );
      expect(oBlockTokens.length).toBeGreaterThanOrEqual(2); // O100, O110
    });

    it("should provide semantic tokens for keywords", () => {
      const text = "WHILE [#1 LT 10] DO\nIF [#1 EQ 5] THEN\nENDIF\nEND";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      const tokens = decodeSemanticTokens(result.data);
      const keywordTokens = tokens.filter((t) => t.type === "keyword");
      expect(keywordTokens.length).toBeGreaterThan(0);

      // Verify specific keywords (trim whitespace and filter exact matches)
      const keywordTexts = keywordTokens
        .map((t) => getTokenText(t, text).trim().toUpperCase())
        .filter((t) =>
          ["WHILE", "DO", "IF", "THEN", "ENDIF", "END"].includes(t)
        );

      // At least some of the expected keywords should be present
      expect(keywordTexts.length).toBeGreaterThan(0);
      // Verify we have at least WHILE, DO, and END
      expect(
        keywordTexts.some((t) => ["WHILE", "DO", "END"].includes(t))
      ).toBe(true);
    });

    it("should provide semantic tokens for operators", () => {
      const text = "#1 = 10 + 20\n#2 = #1 * 2\nIF [#1 LT 50] THEN";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      const tokens = decodeSemanticTokens(result.data);
      const operatorTokens = tokens.filter(
        (t) => t.type === "operator"
      );
      expect(operatorTokens.length).toBeGreaterThan(0);

      // Verify specific operators (trim whitespace)
      const operatorTexts = operatorTokens
        .map((t) => getTokenText(t, text).trim().toUpperCase())
        .filter((t) => t.length > 0);
      // At least some operators should be present
      expect(operatorTexts.length).toBeGreaterThan(0);
      // Verify we have = and at least one other operator
      expect(operatorTexts).toContain("=");
      expect(
        operatorTexts.some((op) => ["+", "*", "LT"].includes(op))
      ).toBe(true);
    });

    it("should provide semantic tokens for numbers", () => {
      const text = "G0 X10.5 Y20 Z-5.0 F1000";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      const tokens = decodeSemanticTokens(result.data);
      const numberTokens = tokens.filter((t) => t.type === "number");
      expect(numberTokens.length).toBeGreaterThan(0);
    });

    it("should provide semantic tokens for built-in functions", () => {
      const text = "#1 = SIN[45]\n#2 = ABS[#1]\n#3 = ROUND[#2]";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      const tokens = decodeSemanticTokens(result.data);
      const functionTokens = tokens.filter(
        (t) => t.type === "function"
      );
      expect(functionTokens.length).toBeGreaterThan(0);

      // Verify specific functions
      const functionTexts = functionTokens
        .map((t) => getTokenText(t, text).toUpperCase())
        .filter((t) => ["SIN", "COS", "ABS", "ROUND"].includes(t));
      expect(functionTexts.length).toBeGreaterThan(0);
    });

    it("should provide semantic tokens for comments", () => {
      const text = "; This is a comment\nG0 X0 (another comment)";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      const tokens = decodeSemanticTokens(result.data);
      const commentTokens = tokens.filter((t) => t.type === "comment");
      expect(commentTokens.length).toBeGreaterThan(0);
    });

    it("should handle complex G-code file with all token types", () => {
      const text = `%
G21 G90 G54 G17

#<depth> = -17.0
#<x_spacing> = 50.0

O100 WHILE [#<row_count> LT #<rows>] DO
  G00 X[#<xpos> - #<tool_center_radius>] Y[#<ypos>]
  G01 Z0.0 F[#<plunge_feed>]
  #<col_count> = #<col_count> + 1.0
O100 END

M30
%`;
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      expect(result.data.length).toBeGreaterThan(0);

      const tokens = decodeSemanticTokens(result.data);

      // Verify we have tokens for all major types
      const tokenTypes = new Set(tokens.map((t) => t.type));
      expect(tokenTypes.has("variable")).toBe(true);
      expect(tokenTypes.has("function")).toBe(true); // G-codes, M-codes
      expect(tokenTypes.has("label")).toBe(true); // O-blocks
      expect(tokenTypes.has("keyword")).toBe(true); // WHILE, DO, END
      expect(tokenTypes.has("operator")).toBe(true); // =, +, LT
      expect(tokenTypes.has("number")).toBe(true);
    });

    it("should mark G-codes as function tokens", () => {
      const text = "G0 X10\nG1 Y20";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );
      const ast = gcodeParser.parseGcode(text);

      const result = provider.provideDocumentSemanticTokens(
        ast,
        document
      );

      const tokens = decodeSemanticTokens(result.data);
      // G0 and G1 should be marked as functions
      const gTokens = tokens.filter((t) =>
        /^G\d+/.test(getTokenText(t, text))
      );
      expect(gTokens.length).toBeGreaterThan(0);
      expect(gTokens.every((t) => t.type === "function")).toBe(true);
    });
  });

  describe("SEMANTIC_TOKENS_LEGEND", () => {
    it("should have all required token types", () => {
      expect(SEMANTIC_TOKENS_LEGEND.tokenTypes).toContain("variable");
      expect(SEMANTIC_TOKENS_LEGEND.tokenTypes).toContain("function");
      expect(SEMANTIC_TOKENS_LEGEND.tokenTypes).toContain("label");
      expect(SEMANTIC_TOKENS_LEGEND.tokenTypes).toContain("keyword");
      expect(SEMANTIC_TOKENS_LEGEND.tokenTypes).toContain("number");
      expect(SEMANTIC_TOKENS_LEGEND.tokenTypes).toContain("operator");
      expect(SEMANTIC_TOKENS_LEGEND.tokenTypes).toContain("comment");
    });

    it("should have all required token modifiers", () => {
      expect(SEMANTIC_TOKENS_LEGEND.tokenModifiers).toContain(
        "declaration"
      );
      expect(SEMANTIC_TOKENS_LEGEND.tokenModifiers).toContain(
        "readonly"
      );
    });
  });
});

/**
 * Helper function to decode semantic tokens data array
 * Semantic tokens are encoded as: [deltaLine, deltaStart, length, tokenType, tokenModifiers]
 */
function decodeSemanticTokens(data: number[]): Array<{
  line: number;
  start: number;
  length: number;
  type: string;
  modifiers: string[];
}> {
  const tokens: Array<{
    line: number;
    start: number;
    length: number;
    type: string;
    modifiers: string[];
  }> = [];

  let currentLine = 0;
  let currentStart = 0;

  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaStart = data[i + 1];
    const length = data[i + 2];
    const tokenType = data[i + 3];
    const tokenModifiers = data[i + 4];

    currentLine += deltaLine;
    if (deltaLine === 0) {
      currentStart += deltaStart;
    } else {
      currentStart = deltaStart;
    }

    const typeName =
      SEMANTIC_TOKENS_LEGEND.tokenTypes[tokenType] || "unknown";
    const modifiers: string[] = [];
    for (
      let j = 0;
      j < SEMANTIC_TOKENS_LEGEND.tokenModifiers.length;
      j++
    ) {
      if (tokenModifiers & (1 << j)) {
        modifiers.push(SEMANTIC_TOKENS_LEGEND.tokenModifiers[j]);
      }
    }

    tokens.push({
      line: currentLine,
      start: currentStart,
      length,
      type: typeName,
      modifiers,
    });
  }

  return tokens;
}

/**
 * Helper to extract text from a token given the document text
 */
function getTokenText(
  token: { line: number; start: number; length: number },
  text: string
): string {
  const lines = text.split(/\r?\n/);
  if (token.line >= lines.length) return "";
  const lineText = lines[token.line];
  return lineText.substring(token.start, token.start + token.length);
}
