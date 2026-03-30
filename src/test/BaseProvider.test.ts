/**
 * BaseProvider Unit Tests
 *
 * Tests the base provider class and its helper methods
 */

import { describe, expect, it } from '@jest/globals';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { DialectType } from '../constants';
import { DEFAULT_GCODE_CONFIG } from '../config/defaults';
import { DocumentStateManager, GCodeSettings } from '../providers/DocumentStateManager';
import { BaseProvider } from '../providers/BaseProvider';

/**
 * Concrete implementation of BaseProvider for testing
 */
class TestProvider extends BaseProvider {
  public testGetDocumentState(document: TextDocument, settings: GCodeSettings) {
    return this.getDocumentState(document, settings);
  }

  public testGetAnalysis(
    document: TextDocument,
    settings: GCodeSettings,
    options?: import('../providers/AnalysisResults').AnalysisOptions
  ) {
    return this.getAnalysis(document, settings, options);
  }

  public testGetDataProvider(dialect?: DialectType) {
    return this.getDataProvider(dialect);
  }
}

describe('BaseProvider', () => {
  const createDocument = (content: string): TextDocument => {
    return TextDocument.create('test://test.nc', 'gcode', 1, content);
  };

  const createSettings = (dialect?: DialectType): GCodeSettings => {
    return {
      formatter: DEFAULT_GCODE_CONFIG.formatter,
      dialect,
    };
  };

  describe('getDocumentState', () => {
    it('should provide access to document state', () => {
      const content = 'G01 X10 Y20';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);
      const settings = createSettings();

      const state = provider.testGetDocumentState(document, settings);

      expect(state).toBeDefined();
      expect(state.ast).toBeDefined();
      expect(state.lexer).toBeDefined();
      expect(state.parser).toBeDefined();
      expect(state.settings).toBe(settings);
    });

    it('should cache document state', () => {
      const content = 'G01 X10 Y20';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);
      const settings = createSettings();

      const state1 = provider.testGetDocumentState(document, settings);
      const state2 = provider.testGetDocumentState(document, settings);

      // Should return the same cached instance
      expect(state1).toBe(state2);
    });
  });

  describe('getAnalysis', () => {
    it('should provide access to analysis results', () => {
      const content = '#<x> = 10\nG01 X#<x>';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);
      const settings = createSettings();

      const analysis = provider.testGetAnalysis(document, settings);

      expect(analysis).toBeDefined();
      expect(analysis.variables).toBeDefined();
      expect(analysis.variables.size).toBeGreaterThan(0);
      expect(analysis.variables.has('x')).toBe(true);
    });

    it('should include errors in analysis', () => {
      const content = 'INVALID SYNTAX HERE';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);
      const settings = createSettings();

      const analysis = provider.testGetAnalysis(document, settings);

      expect(analysis).toBeDefined();
      expect(analysis.errors).toBeDefined();
      // Note: Whether this creates errors depends on parser implementation
    });

    it('should support analysis options', () => {
      const content = 'G01 X10';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);
      const settings = createSettings();

      const analysis = provider.testGetAnalysis(document, settings, { includeTokens: true });

      expect(analysis).toBeDefined();
      expect(analysis.tokens).toBeDefined();
    });
  });

  describe('getDataProvider', () => {
    it('should provide access to dialect-specific data provider', () => {
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);

      const dataProvider = provider.testGetDataProvider(DialectType.LINUXCNC);

      expect(dataProvider).toBeDefined();
      expect(typeof dataProvider.getAllCommands).toBe('function');
      expect(typeof dataProvider.getAllFunctions).toBe('function');
      expect(typeof dataProvider.getAllOperators).toBe('function');
    });

    it('should return LinuxCNC provider when no dialect specified', () => {
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);

      const dataProvider = provider.testGetDataProvider();

      expect(dataProvider).toBeDefined();
      // Should return a valid data provider (default LinuxCNC)
      const commands = dataProvider.getAllCommands();
      expect(commands).toBeDefined();
      expect(Array.isArray(commands)).toBe(true);
    });

    it('should return different providers for different dialects', () => {
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);

      const linuxcncProvider = provider.testGetDataProvider(DialectType.LINUXCNC);
      const fanucProvider = provider.testGetDataProvider(DialectType.FANUC);

      expect(linuxcncProvider).toBeDefined();
      expect(fanucProvider).toBeDefined();
      // They should be different instances
      expect(linuxcncProvider).not.toBe(fanucProvider);
    });

    it('should cache providers per dialect', () => {
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);

      const provider1 = provider.testGetDataProvider(DialectType.FANUC);
      const provider2 = provider.testGetDataProvider(DialectType.FANUC);

      // Should return the same cached instance
      expect(provider1).toBe(provider2);
    });
  });

  describe('integration', () => {
    it('should work with all helper methods together', () => {
      const content = '#<x> = 10\nG01 X#<x>';
      const document = createDocument(content);
      const stateManager = new DocumentStateManager();
      const provider = new TestProvider(stateManager);
      const settings = createSettings(DialectType.LINUXCNC);

      // Get document state
      const state = provider.testGetDocumentState(document, settings);
      expect(state).toBeDefined();

      // Get analysis
      const analysis = provider.testGetAnalysis(document, settings);
      expect(analysis).toBeDefined();
      expect(analysis.variables.has('x')).toBe(true);

      // Get data provider
      const dataProvider = provider.testGetDataProvider(DialectType.LINUXCNC);
      expect(dataProvider).toBeDefined();

      // Verify data provider can get command info
      const g01Info = dataProvider.getCommandInfo('G01');
      expect(g01Info).toBeDefined();
    });
  });
});
