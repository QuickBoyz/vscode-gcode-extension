/**
 * Tests for DocumentSymbolProvider
 */
import { DocumentSymbolProvider } from "../DocumentSymbolProvider";
import { DocumentStateManager } from "../DocumentStateManager";
import { TextDocument } from "vscode-languageserver-textdocument";
import { SymbolKind } from "vscode-languageserver/node";

describe("DocumentSymbolProvider", () => {
  let provider: DocumentSymbolProvider;
  let stateManager: DocumentStateManager;

  beforeEach(() => {
    stateManager = new DocumentStateManager();
    provider = new DocumentSymbolProvider(stateManager);
  });

  describe("provideDocumentSymbols", () => {
    it("should return symbols for all variable definitions", () => {
      const text = "#<x> = 10\n#<y> = 20";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols.length).toBe(2);
      expect(symbols[0].name).toBe("#<x>");
      expect(symbols[1].name).toBe("#<y>");
      expect(symbols[0].kind).toBe(SymbolKind.Variable);
      expect(symbols[1].kind).toBe(SymbolKind.Variable);
    });

    it("should include both numeric and named variables", () => {
      const text = "#1 = 10\n#<foo> = 20";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols.length).toBe(2);
      const names = symbols.map((s) => s.name);
      expect(names).toContain("#1");
      expect(names).toContain("#<foo>");
    });

    it("should sort symbols by line number", () => {
      const text = "#<z> = 30\n#<a> = 10\n#<b> = 20";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols.length).toBe(3);
      expect(symbols[0].range.start.line).toBeLessThanOrEqual(
        symbols[1].range.start.line
      );
      expect(symbols[1].range.start.line).toBeLessThanOrEqual(
        symbols[2].range.start.line
      );
    });

    it("should return empty array for document with no variables", () => {
      const text = "G0 X0 Y0";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols).toEqual([]);
    });

    it("should not include variable references, only definitions", () => {
      const text = "#<x> = 10\n#<y> = #<x>\n#<z> = #<x>";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols.length).toBe(3); // Only definitions, not references
      const names = symbols.map((s) => s.name);
      expect(names).toContain("#<x>");
      expect(names).toContain("#<y>");
      expect(names).toContain("#<z>");
    });

    it("should have correct range and selectionRange", () => {
      const text = "#<x> = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols.length).toBe(1);
      const symbol = symbols[0];
      expect(symbol.range).toBeDefined();
      expect(symbol.selectionRange).toBeDefined();
      // Selection range should be within full range
      expect(symbol.selectionRange.start.line).toBeGreaterThanOrEqual(
        symbol.range.start.line
      );
      expect(symbol.selectionRange.end.line).toBeLessThanOrEqual(
        symbol.range.end.line
      );
    });

    it("should handle variables in conditional statements", () => {
      const text =
        "#<x> = 10\nWHILE [#<x> LT 20] DO\n  #<y> = #<x>\nEND";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const symbols = provider.provideDocumentSymbols(document);

      expect(symbols.length).toBe(2);
      const names = symbols.map((s) => s.name);
      expect(names).toContain("#<x>");
      expect(names).toContain("#<y>");
    });
  });
});

