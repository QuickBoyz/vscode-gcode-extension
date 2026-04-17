/**
 * Semantic Analysis Visitor
 *
 * Walks the AST to build modal machine state and produce semantic diagnostics.
 *
 * Tracks:
 * - Motion mode (G00/G01/G02/G03)
 * - Feed rate, spindle speed, tool number
 * - Spindle state (M03/M04/M05)
 * - Coolant state (M07/M08/M09)
 * - Distance mode (G90/G91)
 * - Plane selection (G17/G18/G19)
 * - Program end (M02/M30)
 *
 * Produces diagnostics for:
 * - Unknown G/M commands
 * - Missing feed rate before cutting moves
 * - Unreachable code after program end
 * - Duplicate line numbers
 */
import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import {
  AxisParameterNode,
  DiagnosticCategory,
  LineNumberNode,
  MotionCommandNode,
  ProgramDelimiterNode,
  Range,
  SubroutineLabelNode,
} from '../parser/nodes';
import { normalizeCommand } from '../utils/GCodeNormalizer';
import {
  SPINDLE_CW_COMMAND,
  SPINDLE_CCW_COMMAND,
  SPINDLE_OFF_COMMAND,
  COOLANT_MIST_COMMAND,
  COOLANT_FLOOD_COMMAND,
  COOLANT_OFF_COMMAND,
  ABSOLUTE_COMMANDS,
  INCREMENTAL_COMMANDS,
  PLANE_XY_COMMAND,
  PLANE_XZ_COMMAND,
  PLANE_YZ_COMMAND,
  TOOL_CHANGE_COMMAND,
  FEED_RATE_AXIS,
} from '../constants/GCodeCommands';
import { IDataProvider } from './IDataProvider';
import { SemanticDiagnostic, SemanticDiagnosticCode } from './SemanticDiagnostic';

// -- Modal state enums --

enum SpindleState {
  OFF = 'OFF',
  CW = 'CW',
  CCW = 'CCW',
}

enum CoolantState {
  OFF = 'OFF',
  MIST = 'MIST',
  FLOOD = 'FLOOD',
}

enum DistanceMode {
  ABSOLUTE = 'ABSOLUTE',
  INCREMENTAL = 'INCREMENTAL',
}

enum PlaneSelection {
  XY = 'XY',
  XZ = 'XZ',
  YZ = 'YZ',
}

/**
 * Mutable machine state tracked during AST traversal.
 */
class MachineState {
  motionMode: string | null = null;
  feedRateSet = false;
  spindleState: SpindleState = SpindleState.OFF;
  coolantState: CoolantState = CoolantState.OFF;
  distanceMode: DistanceMode = DistanceMode.ABSOLUTE;
  planeSelection: PlaneSelection = PlaneSelection.XY;
  programEnded = false;
  toolChanged = false;

  /**
   * Reset all tracked state to initial values for a new program section.
   * When adding new state fields to MachineState, add them here too.
   */
  reset(): void {
    this.motionMode = null;
    this.feedRateSet = false;
    this.spindleState = SpindleState.OFF;
    this.coolantState = CoolantState.OFF;
    this.distanceMode = DistanceMode.ABSOLUTE;
    this.planeSelection = PlaneSelection.XY;
    this.programEnded = false;
    this.toolChanged = false;
  }
}

/**
 * Visitor that walks the AST, updates modal state, and collects semantic diagnostics.
 */
export class SemanticAnalysisVisitor extends BaseAstVisitor<void> {
  private readonly state = new MachineState();
  private readonly diagnostics: SemanticDiagnostic[] = [];
  private readonly lineNumbers = new Map<string, Range>();

  constructor(private readonly dataProvider: IDataProvider) {
    super();
  }

  protected defaultValue(): void {
    // No-op
  }

  visitMotionCommand(node: MotionCommandNode): void {
    const normalized = normalizeCommand(node.command);

    // Check for unreachable code first
    if (this.state.programEnded) {
      this.diagnostics.push({
        range: node.getRange(),
        message: `Unreachable code after program end (M02/M30)`,
        category: DiagnosticCategory.Warning,
        code: SemanticDiagnosticCode.UNREACHABLE_CODE,
      });
      return; // Don't process further — program has ended
    }

    // Process F/S/T parameters from this command before checking state
    for (const param of node.getParameters()) {
      this.updateStateFromParameter(param);
    }

    // Update modal state based on command
    this.updateModalState(normalized);

    // Check if command is known in the dialect
    this.checkCommandKnown(normalized, node);

    // Check for missing feed rate on cutting moves
    this.checkFeedRate(normalized, node);
  }

  visitAxisParameter(node: AxisParameterNode): void {
    // Skip axis parameters that are children of a MotionCommandNode —
    // those are already handled inline in visitMotionCommand.
    // Only process standalone axis parameters (direct children of program/block).
    if (node.getParent() instanceof MotionCommandNode) return;

    if (this.state.programEnded) {
      this.diagnostics.push({
        range: node.getRange(),
        message: `Unreachable code after program end (M02/M30)`,
        category: DiagnosticCategory.Warning,
        code: SemanticDiagnosticCode.UNREACHABLE_CODE,
      });
      return;
    }

    this.updateStateFromParameter(node);

    // If there's an active feed-requiring motion mode and no feed rate set,
    // standalone axis parameters also need a feed rate
    if (
      this.state.motionMode !== null &&
      this.dataProvider.isFeedRequiringCommand(this.state.motionMode) &&
      !this.state.feedRateSet
    ) {
      this.diagnostics.push({
        range: node.getRange(),
        message: `Feed rate (F) not set for modal ${this.state.motionMode} move`,
        category: DiagnosticCategory.Warning,
        code: SemanticDiagnosticCode.MISSING_FEED_RATE,
      });
    }
  }

  visitLineNumber(node: LineNumberNode): void {
    if (this.state.programEnded) {
      this.diagnostics.push({
        range: node.getRange(),
        message: `Unreachable code after program end (M02/M30)`,
        category: DiagnosticCategory.Warning,
        code: SemanticDiagnosticCode.UNREACHABLE_CODE,
      });
    }

    const existing = this.lineNumbers.get(node.lineNumber);
    if (existing) {
      this.diagnostics.push({
        range: node.getRange(),
        message: `Duplicate line number N${node.lineNumber}`,
        category: DiagnosticCategory.Warning,
        code: SemanticDiagnosticCode.DUPLICATE_LINE_NUMBER,
      });
    } else {
      this.lineNumbers.set(node.lineNumber, node.getRange());
    }
  }

  visitProgramDelimiter(_node: ProgramDelimiterNode): void {
    this.resetForNewProgram();
  }

  visitSubroutineLabel(_node: SubroutineLabelNode): void {
    // An O-word after program end signals a new program section
    if (this.state.programEnded) {
      this.resetForNewProgram();
    }
  }

  getDiagnostics(): readonly SemanticDiagnostic[] {
    return this.diagnostics;
  }

  private resetForNewProgram(): void {
    this.state.reset();
    this.lineNumbers.clear();
  }

  private updateStateFromParameter(param: AxisParameterNode): void {
    if (param.axis.toUpperCase() === FEED_RATE_AXIS) {
      this.state.feedRateSet = true;
    }
  }

  private updateModalState(normalized: string): void {
    // Motion mode
    if (this.dataProvider.isMotionCommand(normalized)) {
      this.state.motionMode = normalized;
    }

    // Spindle state
    if (normalized === SPINDLE_CW_COMMAND) this.state.spindleState = SpindleState.CW;
    else if (normalized === SPINDLE_CCW_COMMAND) this.state.spindleState = SpindleState.CCW;
    else if (normalized === SPINDLE_OFF_COMMAND) this.state.spindleState = SpindleState.OFF;

    // Coolant state
    if (normalized === COOLANT_MIST_COMMAND) this.state.coolantState = CoolantState.MIST;
    else if (normalized === COOLANT_FLOOD_COMMAND) this.state.coolantState = CoolantState.FLOOD;
    else if (normalized === COOLANT_OFF_COMMAND) this.state.coolantState = CoolantState.OFF;

    // Distance mode
    if (ABSOLUTE_COMMANDS.has(normalized)) this.state.distanceMode = DistanceMode.ABSOLUTE;
    else if (INCREMENTAL_COMMANDS.has(normalized))
      this.state.distanceMode = DistanceMode.INCREMENTAL;

    // Plane selection
    if (normalized === PLANE_XY_COMMAND) this.state.planeSelection = PlaneSelection.XY;
    else if (normalized === PLANE_XZ_COMMAND) this.state.planeSelection = PlaneSelection.XZ;
    else if (normalized === PLANE_YZ_COMMAND) this.state.planeSelection = PlaneSelection.YZ;

    // Tool change
    if (normalized === TOOL_CHANGE_COMMAND) this.state.toolChanged = true;

    // Program end — M02/M30 resets machine state per ISO 6983
    if (this.dataProvider.isProgramEndCommand(normalized)) {
      this.state.programEnded = true;
      this.state.spindleState = SpindleState.OFF;
      this.state.coolantState = CoolantState.OFF;
      this.state.feedRateSet = false;
      this.state.motionMode = null;
      this.state.toolChanged = false;
    }
  }

  private checkCommandKnown(normalized: string, node: MotionCommandNode): void {
    // Only check G and M codes
    if (!normalized.startsWith('G') && !normalized.startsWith('M')) return;

    const info = this.dataProvider.getCommandInfo(normalized);
    if (!info) {
      this.diagnostics.push({
        range: node.getRange(),
        message: `Unknown command '${node.command}' for the current dialect`,
        category: DiagnosticCategory.Warning,
        code: SemanticDiagnosticCode.UNKNOWN_COMMAND,
      });
    }
  }

  private checkFeedRate(normalized: string, node: MotionCommandNode): void {
    if (this.dataProvider.isFeedRequiringCommand(normalized) && !this.state.feedRateSet) {
      this.diagnostics.push({
        range: node.getRange(),
        message: `Feed rate (F) not set before ${normalized} move`,
        category: DiagnosticCategory.Warning,
        code: SemanticDiagnosticCode.MISSING_FEED_RATE,
      });
    }
  }
}
