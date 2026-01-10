import * as assert from "assert";
import * as vscode from "vscode";
import { TestUtils } from "../testUtils";

const fixtureName = "simple.nc";

// Token types from SemanticTokensProvider
const TOKEN_TYPES = [
  "keyword",
  "variable",
  "number",
  "comment",
  "function",
  "parameter",
  "label",
];

interface DecodedToken {
  line: number;
  startChar: number;
  length: number;
  tokenType: string;
}

function decodeSemanticTokens(data: Uint32Array): DecodedToken[] {
  const tokens: DecodedToken[] = [];
  let line = 0;
  let char = 0;

  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaStartChar = data[i + 1];
    const length = data[i + 2];
    const tokenTypeIndex = data[i + 3];

    line += deltaLine;
    char = deltaLine === 0 ? char + deltaStartChar : deltaStartChar;

    tokens.push({
      line,
      startChar: char,
      length,
      tokenType: TOKEN_TYPES[tokenTypeIndex],
    });
  }

  return tokens;
}

suite("Semantic Tokens Tests", () => {
  TestUtils.setup();

  test("Should provide semantic tokens for G-code document", async () => {
    const document = await TestUtils.openGCodeDocument(fixtureName);

    const tokens = await vscode.commands.executeCommand<
      vscode.SemanticTokens | undefined
    >("vscode.provideDocumentSemanticTokens", document.uri);

    assert.ok(tokens, "Should be able to get semantic tokens");
  });

  test("Should identify variables in semantic tokens", async () => {
    await TestUtils.withTestDocument(
      "#<counter>=0\n#<var>=10\nG1 X[#<counter>] Y[#<var>]",
      async (document) => {
        const tokens = await vscode.commands.executeCommand<
          vscode.SemanticTokens | undefined
        >("vscode.provideDocumentSemanticTokens", document.uri);

        assert.ok(tokens, "Should provide semantic tokens");

        const decoded = decodeSemanticTokens(tokens!.data);
        const variableTokens = decoded.filter(
          (t) => t.tokenType === "variable"
        );

        // Should have 4 variable tokens: #<counter> (assignment and 2 references) + #<var> (assignment and reference)
        assert.ok(
          variableTokens.length >= 4,
          `Should identify at least 4 variable tokens, found ${variableTokens.length}`
        );

        // Verify we have keyword tokens for G1
        const keywordTokens = decoded.filter(
          (t) => t.tokenType === "keyword"
        );
        assert.ok(
          keywordTokens.length > 0,
          "Should identify G1 as keyword"
        );
      },
      "test-temp-variables.nc"
    );
  });

  test("Should identify G and M codes", async () => {
    await TestUtils.withTestDocument(
      "G01 X10\nM03 S1000\nG02 X20 I5 J5",
      async (document) => {
        const tokens = await vscode.commands.executeCommand<
          vscode.SemanticTokens | undefined
        >("vscode.provideDocumentSemanticTokens", document.uri);

        assert.ok(tokens, "Should provide semantic tokens");

        const decoded = decodeSemanticTokens(tokens!.data);
        const keywordTokens = decoded.filter(
          (t) => t.tokenType === "keyword"
        );

        // Should identify G01, M03, G02 as keywords (3 tokens)
        assert.ok(
          keywordTokens.length >= 3,
          `Should identify at least 3 keyword tokens (G01, M03, G02), found ${keywordTokens.length}`
        );

        // Verify we have parameter tokens for X, Y, I, J, S
        const parameterTokens = decoded.filter(
          (t) => t.tokenType === "parameter"
        );
        assert.ok(
          parameterTokens.length >= 5,
          `Should identify at least 5 parameter tokens, found ${parameterTokens.length}`
        );

        // Verify we have number tokens
        const numberTokens = decoded.filter(
          (t) => t.tokenType === "number"
        );
        assert.ok(
          numberTokens.length > 0,
          "Should identify number tokens"
        );
      },
      "test-temp-gm-codes.nc"
    );
  });

  test("Should identify comments", async () => {
    await TestUtils.withTestDocument(
      "; This is a comment\nG01 X10\n(Another comment)",
      async (document) => {
        const tokens = await vscode.commands.executeCommand<
          vscode.SemanticTokens | undefined
        >("vscode.provideDocumentSemanticTokens", document.uri);

        assert.ok(tokens, "Should provide semantic tokens");

        const decoded = decodeSemanticTokens(tokens!.data);
        const commentTokens = decoded.filter(
          (t) => t.tokenType === "comment"
        );

        // Should identify 2 comment tokens: semicolon comment and parentheses comment
        assert.equal(
          commentTokens.length,
          2,
          `Should identify exactly 2 comment tokens, found ${commentTokens.length}`
        );

        // Verify we also have keyword token for G01
        const keywordTokens = decoded.filter(
          (t) => t.tokenType === "keyword"
        );
        assert.ok(
          keywordTokens.length > 0,
          "Should identify G01 as keyword"
        );
      },
      "test-temp-comments.nc"
    );
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand(
      "workbench.action.closeAllEditors"
    );
  });
});
