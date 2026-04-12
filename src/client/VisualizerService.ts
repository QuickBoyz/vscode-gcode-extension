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
import { LexerFactory } from '../lexer/LexerFactory';
import { ParserFactory } from '../parser/ParserFactory';
import { GCodeInterpreter } from '../visualizer/GCodeInterpreter';
import { GCodePathExtractor } from '../visualizer/GCodePathExtractor';
import { VariableResolutionService } from '../visualizer/VariableResolutionService';
import { VariableDefinitions, VisualizerResult } from '../visualizer/types';

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
   * @returns                  A {@link VisualizerResult} indicating success with data or failure with a message
   */
  extractToolPath(
    text: string,
    dialect: DialectType = DialectType.LINUXCNC,
    settingsVariables?: VariableDefinitions
  ): VisualizerResult {
    try {
      const lexer = LexerFactory.create(dialect);
      const tokens = lexer.tokenize(text);
      const parser = ParserFactory.create(dialect, tokens, text);
      const ast = parser.parseProgram();
      const environment = new VariableResolutionService({ settingsVariables }).resolve();
      const extractor = new GCodePathExtractor();
      const interpreter = new GCodeInterpreter(extractor, undefined, environment);
      const data = extractor.extract(ast, interpreter);
      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred during G-code parsing';
      return { success: false, errorMessage };
    }
  }
}
