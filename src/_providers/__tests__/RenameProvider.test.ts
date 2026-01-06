/**
 * Tests for RenameProvider
 */
import { RenameProvider } from "../RenameProvider";
import { DocumentStateManager } from "../DocumentStateManager";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position } from "vscode-languageserver/node";

describe("RenameProvider", () => {
  let provider: RenameProvider;
  let stateManager: DocumentStateManager;

  beforeEach(() => {
    stateManager = new DocumentStateManager();
    provider = new RenameProvider(stateManager);
  });

  describe("prepareRename", () => {
    it("should return range and placeholder for named variable", () => {
      const text = "#<x> = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.prepareRename(document, Position.create(0, 1));

      expect(result).not.toBeNull();
      if (result && "range" in result) {
        expect(result.placeholder).toBe("#<x>");
        expect(result.range).toBeDefined();
      }
    });

    it("should return range and placeholder for numeric variable", () => {
      const text = "#1 = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.prepareRename(document, Position.create(0, 1));

      expect(result).not.toBeNull();
      if (result && "range" in result) {
        expect(result.placeholder).toBe("#1");
      }
    });

    it("should return null if position is not on a variable", () => {
      const text = "G0 X0";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.prepareRename(document, Position.create(0, 0));

      expect(result).toBeNull();
    });

    it("should return range for variable reference", () => {
      const text = "#<x> = 10\n#<y> = #<x>";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.prepareRename(
        document,
        Position.create(1, 8)
      );

      expect(result).not.toBeNull();
      if (result && "range" in result) {
        expect(result.placeholder).toBe("#<x>");
      }
    });
  });

  describe("provideRenameEdits", () => {
    it("should rename named variable with single reference", () => {
      const text = "#<x> = 10\n#<y> = #<x>";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "foo"
      );

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(2); // Definition + reference
        expect(edits[0].newText).toBe("#<foo>");
        expect(edits[1].newText).toBe("#<foo>");
      }
    });

    it("should rename numeric variable", () => {
      const text = "#1 = 10\n#3 = #1";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "2"
      );

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(2);
        expect(edits[0].newText).toBe("#2");
        expect(edits[1].newText).toBe("#2");
      }
    });

    it("should rename variable with multiple references", () => {
      const text = "#<x> = 10\n#<y> = #<x>\n#<z> = #<x> + #<x>";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "foo"
      );

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(4); // 1 definition + 3 references
        edits.forEach((edit) => {
          expect(edit.newText).toBe("#<foo>");
        });
      }
    });

    it("should return null for invalid new name (numeric variable)", () => {
      const text = "#1 = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "abc"
      );

      expect(result).toBeNull();
    });

    it("should return null for invalid new name (named variable)", () => {
      const text = "#<x> = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "123"
      );

      expect(result).toBeNull();
    });

    it("should return null when renaming numeric to named", () => {
      const text = "#1 = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "foo"
      );

      expect(result).toBeNull();
    });

    it("should return null when renaming named to numeric", () => {
      const text = "#<x> = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "1"
      );

      expect(result).toBeNull();
    });

    it("should return null for conflict with existing variable", () => {
      const text = "#<x> = 10\n#<y> = 20";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "y"
      );

      expect(result).toBeNull();
    });

    it("should allow renaming to same name (no-op)", () => {
      const text = "#<x> = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "x"
      );

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(1);
        expect(edits[0].newText).toBe("#<x>");
      }
    });

    it("should return null if position is not on a variable", () => {
      const text = "G0 X0";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 0),
        "foo"
      );

      expect(result).toBeNull();
    });

    it("should handle variables in expressions", () => {
      const text = "#<a> = 10\n#<b> = #<a> + #<a>";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "x"
      );

      expect(result).not.toBeNull();
      if (result && result.changes) {
        const edits = result.changes[document.uri];
        expect(edits.length).toBe(3); // 1 definition + 2 references
      }
    });

    it("should handle zero as invalid numeric variable name", () => {
      const text = "#1 = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "0"
      );

      expect(result).toBeNull();
    });

    it("should handle negative numbers as invalid", () => {
      const text = "#1 = 10";
      const document = TextDocument.create("file:///test.nc", "gcode", 1, text);

      const result = provider.provideRenameEdits(
        document,
        Position.create(0, 1),
        "-1"
      );

      expect(result).toBeNull();
    });
  });
});

