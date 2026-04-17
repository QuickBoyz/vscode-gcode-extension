/**
 * VisualizerService
 *
 * Encapsulates the pipeline that converts raw G-code text into a
 * {@link ToolPathData} object ready for the 3D webview panel.
 *
 * This service is VS Code-free so it can be tested in isolation without
 * the extension host.
 */
import { DialectType } from '../constants';
import { ParseError } from '../errors/ParseError';
import { LexerFactory } from '../lexer/LexerFactory';
import { ParserFactory } from '../parser/ParserFactory';
import { GCodeInterpreter } from '../visualizer/GCodeInterpreter';
import { ExtractorProgressCallback, GCodePathExtractor } from '../visualizer/GCodePathExtractor';
import { VariableResolutionService } from '../visualizer/VariableResolutionService';
import { VariableDefinitions, VisualizerPhase, VisualizerResult } from '../visualizer/types';

/**
 * Callback fired at each pipeline phase boundary and for intra-phase
 * progress updates during the EXTRACTING phase.
 *
 * Phase-boundary calls carry only `phase`; intra-phase calls also carry
 * a human-readable `message` (e.g. "Extracted 500 segments").
 */
export type PhaseReporter = ExtractorProgressCallback;

export class VisualizerService {
  /**
   * Parses `text` and extracts the complete tool path.
   *
   * Returns a discriminated union so callers can handle parse or extraction
   * errors without try/catch.
   *
   * @param text               Raw G-code file content
   * @param dialect            G-code dialect for lexing and parsing
   * @param settingsVariables  Variables from VS Code settings (`gcode.variables`)
   * @param onProgress         Optional callback fired at phase boundaries and
   *                           during extraction with live segment-count messages.
   * @returns                  A {@link VisualizerResult} indicating success with data or failure with a message
   */
  extractToolPath(
    text: string,
    dialect: DialectType = DialectType.LINUXCNC,
    settingsVariables?: VariableDefinitions,
    onProgress?: PhaseReporter
  ): VisualizerResult {
    try {
      onProgress?.({ phase: VisualizerPhase.PARSING });
      const lexer = LexerFactory.create(dialect);
      const tokens = lexer.tokenize(text);
      const parser = ParserFactory.create(dialect, tokens, text);
      const ast = parser.parseProgram();

      onProgress?.({ phase: VisualizerPhase.EXTRACTING });
      const environment = new VariableResolutionService({ settingsVariables }).resolve();
      const extractor = new GCodePathExtractor();
      const interpreter = new GCodeInterpreter(extractor, undefined, environment);
      const data = extractor.extract(ast, interpreter, onProgress);
      return { success: true, data };
    } catch (error: unknown) {
      if (error instanceof ParseError) {
        return { success: false, errorMessage: error.message, range: error.range };
      }
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred during G-code parsing';
      return { success: false, errorMessage, range: null };
    }
  }
}
