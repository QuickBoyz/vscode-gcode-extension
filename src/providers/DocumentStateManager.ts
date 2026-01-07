/**
 * Document State Manager
 *
 * Caches parsed ASTs, lexer, parser, and settings per document URI
 * to avoid redundant parsing and re-instantiation.
 */
import { TextDocument } from "vscode-languageserver-textdocument";
import { GCodeLexer } from "../lexer/GCodeLexer";
import { GCodeParser } from "../parser/GCodeParser";
import { ProgramNode } from "../parser/nodes";
import { FormatterSettings } from "../formatter/types";

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

  constructor() {
    // Reuse a single lexer instance (stateless after tokenization)
    this.lexer = new GCodeLexer();
  }

  /**
   * Get or parse a document, returning cached state if available
   */
  getOrParseDocument(
    uri: string,
    text: string,
    settings: GCodeSettings
  ): DocumentState {
    const existingState = this.documentStates.get(uri);
    const currentVersion = Date.now();

    // Check if we can reuse cached state
    if (existingState && existingState.settings === settings) {
      // Update last modified timestamp
      existingState.lastModified = currentVersion;
      return existingState;
    }

    // Parse the document
    const tokens = this.lexer.tokenize(text);
    const parser = new GCodeParser(tokens);
    const ast = parser.parseProgram();

    // Get or increment version (persists across invalidations)
    const currentDocVersion = (this.documentVersions.get(uri) ?? 0) + 1;
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
    this.documentStates.delete(uri);
    // Note: We keep version tracking even after invalidation
    // so that subsequent parses continue versioning
  }

  /**
   * Invalidate all cached states
   */
  invalidateAll(): void {
    this.documentStates.clear();
    // Note: We keep version tracking even after invalidation
    // so that subsequent parses continue versioning
  }

  /**
   * Get or parse document from TextDocument
   */
  getOrParseDocumentFromTextDocument(
    document: TextDocument,
    settings: GCodeSettings
  ): DocumentState {
    return this.getOrParseDocument(
      document.uri,
      document.getText(),
      settings
    );
  }
}
