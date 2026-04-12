/**
 * Document State Manager
 *
 * Caches parsed ASTs, lexer, parser, and analysis results per document URI
 * to avoid redundant parsing and analysis.
 *
 * Supports incremental parsing: when a content change is recorded via
 * {@link applyContentChange}, the next call to {@link getOrParseDocument}
 * will attempt to re-parse only the affected region and splice the result
 * into the existing AST. Falls back to full re-parse when incremental
 * parsing is not possible (e.g., block structure changes).
 */
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType } from '../constants';
import { GCodeLexer } from '../lexer/GCodeLexer';
import { LexerFactory } from '../lexer/LexerFactory';
import { BaseParser } from '../parser/BaseParser';
import { ContentChange, IncrementalParsingService } from '../parser/IncrementalParsingService';
import { ProgramNode } from '../parser/nodes';
import { ParserFactory } from '../parser/ParserFactory';
import { AnalysisOptions, AnalysisResults } from './AnalysisResults';
import { AstAnalysisService } from './AstAnalysisService';
import { SemanticAnalyzer } from './SemanticAnalyzer';
import { IDataProvider } from './IDataProvider';
import { IDocumentStateManager } from './IDocumentStateManager';
import { DataProviderFactory } from './DataProviderFactory';
import { FormatterConfig } from '../formatter/types';

/**
 * Settings interface for G-code documents
 */
export interface GCodeSettings {
  formatter: FormatterConfig;
  dialect?: DialectType;
}

/**
 * Cached state for a document
 */
export interface DocumentState {
  ast: ProgramNode;
  lexer: GCodeLexer;
  parser: BaseParser;
  settings: GCodeSettings;
  version: number;
  lastModified: number;
  analysis?: AnalysisResults;
  /** When true, the next getOrParseDocument call will force a full re-parse. */
  needsReparse?: boolean;
}

/**
 * Document State Manager
 *
 * Manages cached document states to avoid redundant parsing.
 * Invalidates cache when documents change.
 */
export class DocumentStateManager implements IDocumentStateManager {
  private documentStates = new Map<string, DocumentState>();
  private documentVersions = new Map<string, number>();
  private dataProviderCache = new Map<string, IDataProvider>();
  private readonly lexerCache = new Map<DialectType, GCodeLexer>();
  private readonly analysisService: AstAnalysisService;
  private readonly semanticAnalyzer: SemanticAnalyzer;
  private readonly incrementalParser = new IncrementalParsingService();

  /** Pending content changes per document URI, consumed on next parse. */
  private pendingChanges = new Map<string, ContentChange>();

  /** Previous document text per URI, needed for incremental diffing. */
  private previousText = new Map<string, string>();

  constructor() {
    this.analysisService = new AstAnalysisService();
    this.semanticAnalyzer = new SemanticAnalyzer();
  }

  private getLexer(dialect: DialectType): GCodeLexer {
    const cached = this.lexerCache.get(dialect);
    if (cached) return cached;
    const lexer = LexerFactory.create(dialect);
    this.lexerCache.set(dialect, lexer);
    return lexer;
  }

  /**
   * Record a content change for a document. On the next call to
   * {@link getOrParseDocument}, the manager will attempt incremental
   * parsing instead of a full re-parse.
   *
   * @param uri    - Document URI
   * @param change - Description of what changed
   */
  applyContentChange(uri: string, change: ContentChange): void {
    // Only keep the latest change — multiple rapid changes collapse
    // to a single pending change (the debounced handler ensures we
    // always have the latest full text when we parse).
    // If we already have a pending change, fall back to full re-parse
    // since merging multiple incremental changes is complex.
    const state = this.documentStates.get(uri);

    if (this.pendingChanges.has(uri)) {
      // Multiple changes before a parse → discard pending, force full re-parse
      this.pendingChanges.delete(uri);
      if (state) {
        state.needsReparse = true;
      }
    } else {
      this.pendingChanges.set(uri, change);
    }

    // Clear cached analysis (always needed on change)
    if (state) {
      state.analysis = undefined;
    }
  }

  /**
   * Get or parse a document, returning cached state if available.
   *
   * If a content change was recorded via {@link applyContentChange},
   * attempts incremental parsing first and falls back to full re-parse
   * if that fails.
   */
  getOrParseDocument(uri: string, text: string, settings: GCodeSettings): DocumentState {
    const existingState = this.documentStates.get(uri),
      currentVersion = Date.now();

    // Check if we can reuse cached state (no pending change, same settings, not invalidated)
    if (
      existingState &&
      existingState.settings === settings &&
      !existingState.needsReparse &&
      !this.pendingChanges.has(uri)
    ) {
      existingState.lastModified = currentVersion;
      return existingState;
    }

    // Try incremental parsing if we have a pending change and an existing AST
    const pendingChange = this.pendingChanges.get(uri);
    this.pendingChanges.delete(uri);

    if (pendingChange && existingState && existingState.settings === settings) {
      const oldText = this.previousText.get(uri);
      if (oldText !== undefined) {
        const dialect = settings.dialect ?? DialectType.LINUXCNC;
        const result = this.incrementalParser.tryIncrementalParse(
          existingState.ast,
          text,
          oldText,
          pendingChange,
          dialect
        );

        if (result.success && result.ast) {
          // Incremental parse succeeded — update state in place
          existingState.ast = result.ast;
          existingState.lastModified = currentVersion;
          existingState.version = (this.documentVersions.get(uri) ?? 0) + 1;
          this.documentVersions.set(uri, existingState.version);
          this.previousText.set(uri, text);
          return existingState;
        }
      }
    }

    // Full re-parse (fallback or first parse)
    return this.fullParse(uri, text, settings, currentVersion);
  }

  /**
   * Perform a full tokenize + parse of the document.
   */
  private fullParse(
    uri: string,
    text: string,
    settings: GCodeSettings,
    currentVersion: number
  ): DocumentState {
    const dialect = settings.dialect ?? DialectType.LINUXCNC,
      lexer = this.getLexer(dialect),
      tokens = lexer.tokenize(text),
      parser = ParserFactory.create(dialect, tokens, text),
      ast = parser.parseProgram(),
      currentDocVersion = (this.documentVersions.get(uri) ?? 0) + 1;
    this.documentVersions.set(uri, currentDocVersion);

    const state: DocumentState = {
      ast,
      lexer,
      parser,
      settings,
      version: currentDocVersion,
      lastModified: currentVersion,
    };

    this.documentStates.set(uri, state);
    this.previousText.set(uri, text);
    return state;
  }

  /**
   * Get cached document state if available
   */
  getDocumentState(uri: string): DocumentState | undefined {
    return this.documentStates.get(uri);
  }

  /**
   * Invalidate cached state for a document.
   *
   * Clears analysis but preserves the AST so incremental parsing
   * can use it as a baseline. The AST is only replaced on the next
   * call to {@link getOrParseDocument}.
   */
  invalidateDocument(uri: string): void {
    const state = this.documentStates.get(uri);
    if (state) {
      state.analysis = undefined;
      state.needsReparse = true;
    }
  }

  /**
   * Run AST-level analysis (variables, errors, optional semantic tokens) on
   * a pre-parsed program. Unlike {@link getAnalysis}, this does not touch the
   * document cache or run semantic analysis — it is a direct, uncached pass
   * suitable for callers that already hold a {@link DocumentState}.
   */
  analyzeAst(ast: ProgramNode, options: AnalysisOptions = {}): AnalysisResults {
    return this.analysisService.analyze(ast, options);
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

    // Run semantic analysis (modal state, command validation, variable checks)
    const dialect = settings.dialect ?? DialectType.LINUXCNC;
    const dataProvider = this.getDataProvider(dialect);
    state.analysis.semanticDiagnostics = this.semanticAnalyzer.analyze(
      state.ast,
      state.analysis,
      dataProvider
    );

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
   * Remove all cached state for a document (e.g. when it is closed).
   */
  removeDocument(uri: string): void {
    this.documentStates.delete(uri);
    this.documentVersions.delete(uri);
    this.pendingChanges.delete(uri);
    this.previousText.delete(uri);
  }

  /**
   * Invalidate all cached states
   */
  invalidateAll(): void {
    this.documentStates.clear();
    this.pendingChanges.clear();
    this.previousText.clear();
  }

  /**
   * Clear all caches including data providers (called on settings change)
   */
  clearAll(): void {
    this.documentStates.clear();
    this.dataProviderCache.clear();
    this.pendingChanges.clear();
    this.previousText.clear();
  }

  /**
   * Get dialect-specific data provider for the given dialect.
   * Caches providers per dialect to avoid recreating them.
   *
   * @param dialect The G-code dialect to get a provider for (defaults to LinuxCNC)
   * @returns The appropriate data provider for the dialect
   */
  getDataProvider(dialect?: DialectType): IDataProvider {
    const dialectKey = dialect ?? DialectType.LINUXCNC;
    const cached = this.dataProviderCache.get(dialectKey);

    if (cached) {
      return cached;
    }

    const provider = DataProviderFactory.create(dialectKey);
    this.dataProviderCache.set(dialectKey, provider);
    return provider;
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
