/**
 * Document State Manager
 *
 * Caches parsed ASTs, lexer, parser, and analysis results per document URI
 * to avoid redundant parsing and analysis.
 */
import { TextDocument } from 'vscode-languageserver-textdocument';

import { FormatterSettings } from '../formatter/types';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { GCodeParser } from '../parser/GCodeParser';
import { ProgramNode } from '../parser/nodes';
import { AnalysisOptions, AnalysisResults } from './AnalysisResults';
import { AstAnalysisService } from './AstAnalysisService';

/**
 * Settings interface for G-code documents
 */
export interface GCodeSettings {
  formatter: FormatterSettings;
}

/**
 * Cached state for a document
 */
export interface DocumentState {
  ast: ProgramNode;
  lexer: GCodeLexer;
  parser: GCodeParser;
  settings: GCodeSettings;
  version: number;
  lastModified: number;
  analysis?: AnalysisResults;
}

/**
 * Document State Manager
 *
 * Manages cached document states to avoid redundant parsing.
 * Invalidates cache when documents change.
 */
export class DocumentStateManager {
  private documentStates = new Map<string, DocumentState>();
  private documentVersions = new Map<string, number>();
  private readonly lexer: GCodeLexer;
  private readonly analysisService: AstAnalysisService;

  constructor() {
    // Reuse a single lexer instance (stateless after tokenization)
    this.lexer = new GCodeLexer();
    this.analysisService = new AstAnalysisService();
  }

  /**
   * Get or parse a document, returning cached state if available
   */
  getOrParseDocument(uri: string, text: string, settings: GCodeSettings): DocumentState {
    const existingState = this.documentStates.get(uri),
      currentVersion = Date.now();

    // Check if we can reuse cached state
    if (existingState && existingState.settings === settings) {
      // Update last modified timestamp
      existingState.lastModified = currentVersion;
      return existingState;
    }

    // Parse the document
    const tokens = this.lexer.tokenize(text),
      parser = new GCodeParser(tokens),
      ast = parser.parseProgram(),
      // Get or increment version (persists across invalidations)
      currentDocVersion = (this.documentVersions.get(uri) ?? 0) + 1;
    this.documentVersions.set(uri, currentDocVersion);

    // Create new state
    const state: DocumentState = {
      ast,
      lexer: this.lexer,
      parser,
      settings,
      version: currentDocVersion,
      lastModified: currentVersion,
    };

    this.documentStates.set(uri, state);
    return state;
  }

  /**
   * Get cached document state if available
   */
  getDocumentState(uri: string): DocumentState | undefined {
    return this.documentStates.get(uri);
  }

  /**
   * Invalidate cached state for a document
   */
  invalidateDocument(uri: string): void {
    const state = this.documentStates.get(uri);
    if (state) {
      // Clear cached analysis when document changes
      state.analysis = undefined;
    }
    this.documentStates.delete(uri);
    // Note: We keep version tracking even after invalidation
    // So that subsequent parses continue versioning
  }

  /**
   * Get or compute analysis results for a document
   */
  getAnalysis(
    uri: string,
    text: string,
    settings: GCodeSettings,
    options: AnalysisOptions = {}
  ): AnalysisResults {
    const state = this.getOrParseDocument(uri, text, settings);

    // Return cached analysis if available and options match
    if (state.analysis) {
      // If tokens requested but not cached, recompute
      if (options.includeTokens && !state.analysis.tokens) {
        state.analysis = this.analysisService.analyze(state.ast, options);
      }
      return state.analysis;
    }

    // Compute and cache analysis
    state.analysis = this.analysisService.analyze(state.ast, options);
    return state.analysis;
  }

  /**
   * Get analysis from TextDocument
   */
  getAnalysisFromTextDocument(
    document: TextDocument,
    settings: GCodeSettings,
    options: AnalysisOptions = {}
  ): AnalysisResults {
    return this.getAnalysis(document.uri, document.getText(), settings, options);
  }

  /**
   * Invalidate all cached states
   */
  invalidateAll(): void {
    this.documentStates.clear();
    // Note: We keep version tracking even after invalidation
    // So that subsequent parses continue versioning
  }

  /**
   * Get or parse document from TextDocument
   */
  getOrParseDocumentFromTextDocument(
    document: TextDocument,
    settings: GCodeSettings
  ): DocumentState {
    return this.getOrParseDocument(document.uri, document.getText(), settings);
  }
}
