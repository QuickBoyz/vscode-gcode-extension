/**
 * Tests for Token Utilities
 */
import { deduplicateTokens, SemanticToken } from "./tokenUtils";

describe("Token Utilities", () => {
  describe("deduplicateTokens", () => {
    it("should return empty array for empty input", () => {
      const tokens: SemanticToken[] = [];
      const result = deduplicateTokens(tokens);
      expect(result).toEqual([]);
    });

    it("should return tokens as-is when there are no overlaps", () => {
      const tokens: SemanticToken[] = [
        {
          line: 0,
          character: 0,
          length: 2,
          tokenType: "keyword",
          modifiers: [],
        },
        {
          line: 0,
          character: 5,
          length: 1,
          tokenType: "operator",
          modifiers: [],
        },
        {
          line: 1,
          character: 0,
          length: 3,
          tokenType: "function",
          modifiers: [],
        },
      ];

      const result = deduplicateTokens(tokens);
      expect(result).toEqual(tokens);
      expect(result).toHaveLength(3);
    });

    it("should remove overlapping tokens, keeping the longer one", () => {
      const tokens: SemanticToken[] = [
        {
          line: 0,
          character: 0,
          length: 2,
          tokenType: "keyword",
          modifiers: [],
        },
        {
          line: 0,
          character: 1,
          length: 1,
          tokenType: "operator",
          modifiers: [],
        }, // Overlaps with first token
      ];

      const result = deduplicateTokens(tokens);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(tokens[0]); // Should keep the longer token
    });

    it("should handle multiple overlapping tokens", () => {
      const tokens: SemanticToken[] = [
        {
          line: 0,
          character: 0,
          length: 5,
          tokenType: "variable",
          modifiers: [],
        },
        {
          line: 0,
          character: 2,
          length: 2,
          tokenType: "operator",
          modifiers: [],
        }, // Overlaps with first
        {
          line: 0,
          character: 6,
          length: 3,
          tokenType: "function",
          modifiers: [],
        }, // No overlap
      ];

      const result = deduplicateTokens(tokens);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(tokens[0]); // Keep longer overlapping token
      expect(result[1]).toEqual(tokens[2]); // Keep non-overlapping token
    });

    it("should keep tokens with same start position but different lengths", () => {
      const tokens: SemanticToken[] = [
        {
          line: 0,
          character: 0,
          length: 1,
          tokenType: "operator",
          modifiers: [],
        },
        {
          line: 0,
          character: 0,
          length: 3,
          tokenType: "variable",
          modifiers: [],
        }, // Same start, longer
      ];

      const result = deduplicateTokens(tokens);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(tokens[1]); // Keep the longer one
    });

    it("should handle tokens on different lines", () => {
      const tokens: SemanticToken[] = [
        {
          line: 0,
          character: 0,
          length: 2,
          tokenType: "keyword",
          modifiers: [],
        },
        {
          line: 1,
          character: 0,
          length: 2,
          tokenType: "keyword",
          modifiers: [],
        },
        {
          line: 0,
          character: 1,
          length: 1,
          tokenType: "operator",
          modifiers: [],
        }, // Overlaps with first on line 0
      ];

      const result = deduplicateTokens(tokens);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(tokens[0]); // Keep longer on line 0
      expect(result[1]).toEqual(tokens[1]); // Keep token on line 1
    });

    it("should preserve modifiers when deduplicating", () => {
      const tokens: SemanticToken[] = [
        {
          line: 0,
          character: 0,
          length: 2,
          tokenType: "variable",
          modifiers: ["declaration"],
        },
        {
          line: 0,
          character: 1,
          length: 1,
          tokenType: "operator",
          modifiers: [],
        }, // Overlaps
      ];

      const result = deduplicateTokens(tokens);
      expect(result).toHaveLength(1);
      expect(result[0].modifiers).toEqual(["declaration"]);
    });

    it("should handle complex overlapping scenarios", () => {
      const tokens: SemanticToken[] = [
        {
          line: 0,
          character: 0,
          length: 10,
          tokenType: "variable",
          modifiers: [],
        },
        {
          line: 0,
          character: 2,
          length: 3,
          tokenType: "operator",
          modifiers: [],
        }, // Overlaps with first
        {
          line: 0,
          character: 8,
          length: 5,
          tokenType: "function",
          modifiers: [],
        }, // Overlaps with first
        {
          line: 0,
          character: 15,
          length: 2,
          tokenType: "keyword",
          modifiers: [],
        }, // No overlap
      ];

      const result = deduplicateTokens(tokens);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(tokens[0]); // Keep the longest overlapping token
      expect(result[1]).toEqual(tokens[3]); // Keep non-overlapping token
    });

    it("should handle tokens that exactly match in position and length", () => {
      const tokens: SemanticToken[] = [
        {
          line: 0,
          character: 0,
          length: 5,
          tokenType: "variable",
          modifiers: [],
        },
        {
          line: 0,
          character: 0,
          length: 5,
          tokenType: "variable",
          modifiers: [],
        }, // Exact duplicate
      ];

      const result = deduplicateTokens(tokens);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(tokens[0]);
    });

    it("should handle adjacent tokens (no overlap)", () => {
      const tokens: SemanticToken[] = [
        {
          line: 0,
          character: 0,
          length: 2,
          tokenType: "keyword",
          modifiers: [],
        },
        {
          line: 0,
          character: 2,
          length: 3,
          tokenType: "variable",
          modifiers: [],
        }, // Adjacent
      ];

      const result = deduplicateTokens(tokens);
      expect(result).toEqual(tokens);
      expect(result).toHaveLength(2);
    });
  });
});
