/**
 * VisualizerService
 *
 * Encapsulates the pipeline that converts raw G-code text into a
 * {@link ToolPathData} object ready for the 3D webview panel.
 *
 * This service is VS Code–free so it can be tested in isolation without
 * the extension host.
 */
import { GCodeLexer } from '../lexer/GCodeLexer';
import { GCodeParser } from '../parser/GCodeParser';
import { GCodePathExtractor } from '../visualizer/GCodePathExtractor';
import { ToolPathData } from '../visualizer/types';

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
   * @param text - Raw G-code file content
   * @returns   Tool path data including segments and bounding box
   */
  extractToolPath(text: string): ToolPathData {
    const tokens = this.lexer.tokenize(text);
    const parser = new GCodeParser(tokens, text);
    const ast = parser.parseProgram();
    return this.extractor.extract(ast);
  }
}
