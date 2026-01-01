/**
 * Tests for Variable Tracker
 */
import { VariableTracker } from "./variableTracker";
import { gcodeParser } from "../parser";

describe("VariableTracker", () => {
  const tracker = new VariableTracker();

  describe("findAssignments", () => {
    it("should find numeric variable assignments", () => {
      const text = "#1=10\n#2=20\nG0 X#1";
      const program = gcodeParser.parseGcode(text);

      const assignments = tracker.findAssignments(program);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].getVariable()?.toString()).toBe("#1");
      expect(assignments[1].getVariable()?.toString()).toBe("#2");
    });

    it("should find named variable assignments", () => {
      const text = "#<depth>=-17\n#<x_spacing>=50\nG0 X#<x_spacing>";
      const program = gcodeParser.parseGcode(text);

      const assignments = tracker.findAssignments(program);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].getVariable()?.toString()).toBe("#<depth>");
      expect(assignments[1].getVariable()?.toString()).toBe(
        "#<x_spacing>"
      );
    });

    it("should find assignments with line numbers", () => {
      const text = "N10 #1=10\nN20 #2=20";
      const program = gcodeParser.parseGcode(text);

      const assignments = tracker.findAssignments(program);

      expect(assignments).toHaveLength(2);
      expect(assignments[0].getVariable()?.toString()).toBe("#1");
      expect(assignments[1].getVariable()?.toString()).toBe("#2");
    });

    it("should handle empty documents", () => {
      const text = "";
      const program = gcodeParser.parseGcode(text);

      const assignments = tracker.findAssignments(program);

      expect(assignments).toHaveLength(0);
    });
  });
});
