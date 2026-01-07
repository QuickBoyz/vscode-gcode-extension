/**
 * Tests for DocumentHighlightProvider
 */
import { TextDocument } from "vscode-languageserver-textdocument";
import { DocumentHighlightKind } from "vscode-languageserver/node";
import { Position } from "../../_parser/nodes";
import { DEFAULT_FORMATTER_SETTINGS } from "../../constants";
import { DocumentHighlightProvider } from "../DocumentHighlightProvider";
import {
  DocumentStateManager,
  GCodeSettings,
} from "../DocumentStateManager";

const TEST_SETTINGS: GCodeSettings = {
  formatter: DEFAULT_FORMATTER_SETTINGS,
};

describe("DocumentHighlightProvider", () => {
  let provider: DocumentHighlightProvider;
  let stateManager: DocumentStateManager;

  beforeEach(() => {
    stateManager = new DocumentStateManager();
    provider = new DocumentHighlightProvider(stateManager);
  });

  describe("provideDocumentHighlights", () => {
    it("should highlight definition and references", () => {
      const text = "#<x> = 10\n#<y> = #<x>";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );

      const highlights = provider.provideDocumentHighlights(
        document,
        Position.create(0, 1),
        TEST_SETTINGS
      );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(2);
      expect(highlights?.[0].kind).toBe(DocumentHighlightKind.Write);
      expect(highlights?.[1].kind).toBe(DocumentHighlightKind.Read);
    });

    it("should highlight all references when cursor is on reference", () => {
      const text = "#<x> = 10\n#<y> = #<x>\n#<z> = #<x>";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );

      const highlights = provider.provideDocumentHighlights(
        document,
        Position.create(1, 8),
        TEST_SETTINGS
      );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(3); // 1 definition + 2 references
      const writeHighlights = highlights?.filter(
        (h) => h.kind === DocumentHighlightKind.Write
      );
      const readHighlights = highlights?.filter(
        (h) => h.kind === DocumentHighlightKind.Read
      );
      expect(writeHighlights?.length).toBe(1);
      expect(readHighlights?.length).toBe(2);
    });

    it("should return null if position is not on a variable", () => {
      const text = "G0 X0";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );

      const highlights = provider.provideDocumentHighlights(
        document,
        Position.create(0, 0),
        TEST_SETTINGS
      );

      expect(highlights).toBeNull();
    });

    it("should highlight numeric variables", () => {
      const text = "#1 = 10\n#2 = #1";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );

      const highlights = provider.provideDocumentHighlights(
        document,
        Position.create(0, 1),
        TEST_SETTINGS
      );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(2);
    });

    it("should highlight variable with no references (only definition)", () => {
      const text = "#<x> = 10";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );

      const highlights = provider.provideDocumentHighlights(
        document,
        Position.create(0, 1),
        TEST_SETTINGS
      );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(1);
      expect(highlights?.[0].kind).toBe(DocumentHighlightKind.Write);
    });

    it("should highlight variable with only references (no definition)", () => {
      const text = "#<y> = #<x>";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );

      const highlights = provider.provideDocumentHighlights(
        document,
        Position.create(0, 8),
        TEST_SETTINGS
      );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(1);
      expect(highlights?.[0].kind).toBe(DocumentHighlightKind.Read);
    });

    it("should handle variables in expressions", () => {
      const text = "#<a> = 10\n#<b> = #<a> + #<a>";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );

      const highlights = provider.provideDocumentHighlights(
        document,
        Position.create(0, 1),
        TEST_SETTINGS
      );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(3); // 1 definition + 2 references
    });

    it("should highlight all assignments (multiple definitions)", () => {
      const text = "#<x> = 10\n#<x> = 20\n#<y> = #<x>";
      const document = TextDocument.create(
        "file:///test.nc",
        "gcode",
        1,
        text
      );

      const highlights = provider.provideDocumentHighlights(
        document,
        Position.create(0, 1), // Position on first assignment
        TEST_SETTINGS
      );

      expect(highlights).not.toBeNull();
      expect(highlights?.length).toBe(3); // 2 assignments + 1 reference
      const writeHighlights = highlights?.filter(
        (h) => h.kind === DocumentHighlightKind.Write
      );
      const readHighlights = highlights?.filter(
        (h) => h.kind === DocumentHighlightKind.Read
      );
      expect(writeHighlights?.length).toBe(2); // Both assignments should be Write
      expect(readHighlights?.length).toBe(1); // Reference should be Read
    });
  });
});
