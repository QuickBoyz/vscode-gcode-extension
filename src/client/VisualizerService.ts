/**
 * VisualizerService
 *
 * Encapsulates the pipeline that converts raw G-code text into a
 * {@link ToolPathData} object ready for the 3D webview panel.
 *
 * This service is VS Code-free so it can be tested in isolation without
 * the extension host.
 */
import { ExtractorConfig } from '../config';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { GCodeParser } from '../parser/GCodeParser';
import { GCodePathExtractor } from '../visualizer/GCodePathExtractor';
import { VisualizerResult } from '../visualizer/types';

export class VisualizerService {
  private readonly lexer: GCodeLexer;
  private readonly extractor: GCodePathExtractor;

  constructor() {
    this.lexer = new GCodeLexer();
    this.extractor = new GCodePathExtractor();
  }

  /**
   * Parses `text` and extracts the complete tool path.
   *
   * Returns a discriminated union so callers can handle parse or extraction
   * errors without try/catch.
   *
   * @param text             Raw G-code file content
   * @param extractorConfig  Optional extractor configuration (machine home, max iterations)
   * @returns   A {@link VisualizerResult} indicating success with data or failure with a message
   */
  extractToolPath(text: string, extractorConfig?: ExtractorConfig): VisualizerResult {
    try {
      const tokens = this.lexer.tokenize(text);
      const parser = new GCodeParser(tokens, text);
      const ast = parser.parseProgram();
      const data = this.extractor.extract(ast, extractorConfig);
      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred during G-code parsing';
      return { success: false, errorMessage };
    }
  }
}
