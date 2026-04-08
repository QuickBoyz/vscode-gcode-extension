/**
 * Workspace Symbol Index
 *
 * Maintains an in-memory index of symbols across all G-code files
 * in the workspace. Supports fuzzy matching for workspace symbol search.
 *
 * Uses the existing lexer/parser pipeline to extract symbols from files
 * via the WorkspaceSymbolVisitor.
 */
import { DialectType } from '../constants';
import { LexerFactory } from '../lexer/LexerFactory';
import { AstTraverser } from '../parser/AstTraverser';
import { ParserFactory } from '../parser/ParserFactory';
import { WorkspaceSymbol, WorkspaceSymbolVisitor } from './WorkspaceSymbolVisitor';

/** Default maximum number of symbols to return from a search query. */
const DEFAULT_MAX_RESULTS = 100;

/** Default maximum number of symbols to index across the workspace. */
const DEFAULT_MAX_SYMBOLS = 10000;

/**
 * Configuration for the workspace symbol index.
 */
export interface WorkspaceSymbolIndexConfig {
  /** Whether workspace indexing is enabled. */
  readonly indexingEnabled: boolean;
  /** Maximum number of symbols to index across all files. */
  readonly maxSymbols: number;
}

/**
 * In-memory index of workspace symbols.
 *
 * Stores symbols per file URI. When a file changes, its entry is
 * invalidated and rebuilt from the new content on the next indexing pass.
 * Supports fuzzy (substring) matching for workspace symbol queries.
 */
export class WorkspaceSymbolIndex {
  /** Symbols indexed per file URI. */
  private readonly fileSymbols = new Map<string, readonly WorkspaceSymbol[]>();

  /** Total number of symbols currently indexed. */
  private totalSymbolCount = 0;

  /** Maximum symbols to store across all files. */
  private maxSymbols: number;

  constructor(maxSymbols: number = DEFAULT_MAX_SYMBOLS) {
    this.maxSymbols = maxSymbols;
  }

  /**
   * Update the maximum symbols limit.
   */
  setMaxSymbols(maxSymbols: number): void {
    this.maxSymbols = maxSymbols;
  }

  /**
   * Index a single file by parsing its content and extracting symbols.
   *
   * @param uri     - File URI
   * @param content - File text content
   * @param dialect - G-code dialect to use for parsing
   */
  indexFile(uri: string, content: string, dialect: DialectType = DialectType.LINUXCNC): void {
    // Remove existing symbols for this file first
    this.removeFile(uri);

    // Check if we've hit the global limit
    if (this.totalSymbolCount >= this.maxSymbols) {
      return;
    }

    const symbols = this.extractSymbols(uri, content, dialect);

    // Clamp to remaining capacity
    const remaining = this.maxSymbols - this.totalSymbolCount;
    const trimmedSymbols = symbols.length > remaining ? symbols.slice(0, remaining) : symbols;

    this.fileSymbols.set(uri, trimmedSymbols);
    this.totalSymbolCount += trimmedSymbols.length;
  }

  /**
   * Remove all indexed symbols for a file.
   *
   * @param uri - File URI to remove
   */
  removeFile(uri: string): void {
    const existing = this.fileSymbols.get(uri);
    if (existing) {
      this.totalSymbolCount -= existing.length;
      this.fileSymbols.delete(uri);
    }
  }

  /**
   * Check whether a file is currently indexed.
   */
  hasFile(uri: string): boolean {
    return this.fileSymbols.has(uri);
  }

  /**
   * Search the index for symbols matching a query string.
   *
   * Uses case-insensitive substring matching. An empty query returns
   * all indexed symbols (up to maxResults).
   *
   * @param query      - Search query (empty string = all symbols)
   * @param maxResults - Maximum number of results to return
   * @returns Matching symbols, sorted by relevance (prefix > substring)
   */
  search(query: string, maxResults: number = DEFAULT_MAX_RESULTS): readonly WorkspaceSymbol[] {
    const normalizedQuery = query.toLowerCase();
    const matches: WorkspaceSymbol[] = [];

    for (const symbols of this.fileSymbols.values()) {
      for (const symbol of symbols) {
        if (normalizedQuery === '' || symbol.name.toLowerCase().includes(normalizedQuery)) {
          matches.push(symbol);
        }
      }
    }

    // Sort by relevance: prefix matches first, then alphabetical
    if (normalizedQuery !== '') {
      matches.sort((first, second) => {
        const firstStartsWith = first.name.toLowerCase().startsWith(normalizedQuery);
        const secondStartsWith = second.name.toLowerCase().startsWith(normalizedQuery);

        if (firstStartsWith && !secondStartsWith) return -1;
        if (!firstStartsWith && secondStartsWith) return 1;

        // Within the same category, sort alphabetically
        return first.name.localeCompare(second.name);
      });
    }

    return matches.slice(0, maxResults);
  }

  /**
   * Get the total number of indexed symbols.
   */
  getSymbolCount(): number {
    return this.totalSymbolCount;
  }

  /**
   * Get the number of indexed files.
   */
  getFileCount(): number {
    return this.fileSymbols.size;
  }

  /**
   * Get all symbols for a specific file.
   */
  getFileSymbols(uri: string): readonly WorkspaceSymbol[] {
    return this.fileSymbols.get(uri) ?? [];
  }

  /**
   * Clear the entire index.
   */
  clear(): void {
    this.fileSymbols.clear();
    this.totalSymbolCount = 0;
  }

  /**
   * Extract symbols from file content using the lexer/parser pipeline.
   */
  private extractSymbols(
    uri: string,
    content: string,
    dialect: DialectType
  ): readonly WorkspaceSymbol[] {
    const lexer = LexerFactory.create(dialect);
    const tokens = lexer.tokenize(content);
    const parser = ParserFactory.create(dialect, tokens, content);
    const ast = parser.parseProgram();

    const visitor = new WorkspaceSymbolVisitor(uri);
    const traverser = new AstTraverser(visitor);
    traverser.traverseProgram(ast);

    return visitor.getSymbols();
  }
}
