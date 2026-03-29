import { DialectType } from '../../constants';
import { ConfigProvider, DEFAULT_GCODE_CONFIG, DeepPartial, GCodeConfig } from '../../config';

/**
 * Concrete test implementation of the abstract {@link ConfigProvider}.
 * Allows tests to control the raw config returned by fetchRawConfig
 * and track call counts.
 */
class TestConfigProvider extends ConfigProvider {
  /** Raw config that will be returned by fetchRawConfig. */
  rawConfig: Record<string, unknown> = {};

  /** Number of times fetchRawConfig has been called. */
  fetchCallCount = 0;

  async updateConfig(_partial: DeepPartial<GCodeConfig>): Promise<void> {
    // No-op for tests
  }

  protected fetchRawConfig(_uri?: string): Promise<Record<string, unknown>> {
    this.fetchCallCount += 1;
    return Promise.resolve(this.rawConfig);
  }

  /** Expose protected invalidate for testing. */
  doInvalidate(): void {
    this.invalidate();
  }
}

describe('ConfigProvider', () => {
  let provider: TestConfigProvider;

  beforeEach(() => {
    provider = new TestConfigProvider();
  });

  // ---------------------------------------------------------------------------
  // Caching
  // ---------------------------------------------------------------------------

  it('fetches once and returns cached config on subsequent calls', async () => {
    const config1 = await provider.getConfig();
    const config2 = await provider.getConfig();

    expect(provider.fetchCallCount).toBe(1);
    expect(config1).toBe(config2);
  });

  it('re-fetches after invalidation', async () => {
    await provider.getConfig();
    expect(provider.fetchCallCount).toBe(1);

    provider.doInvalidate();
    await provider.getConfig();
    expect(provider.fetchCallCount).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // URI-scoped caching
  // ---------------------------------------------------------------------------

  it('caches separately per URI', async () => {
    provider.rawConfig = { dialect: DialectType.FANUC };
    const configA = await provider.getConfig('file:///a.nc');

    provider.rawConfig = { dialect: DialectType.HAAS };
    const configB = await provider.getConfig('file:///b.nc');

    expect(configA.dialect).toBe(DialectType.FANUC);
    expect(configB.dialect).toBe(DialectType.HAAS);
    expect(provider.fetchCallCount).toBe(2);

    // Subsequent calls should be cached
    const configA2 = await provider.getConfig('file:///a.nc');
    expect(configA2).toBe(configA);
    expect(provider.fetchCallCount).toBe(2);
  });

  it('invalidation clears all URI caches', async () => {
    await provider.getConfig('file:///a.nc');
    await provider.getConfig('file:///b.nc');
    expect(provider.fetchCallCount).toBe(2);

    provider.doInvalidate();

    await provider.getConfig('file:///a.nc');
    expect(provider.fetchCallCount).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // Deep merge
  // ---------------------------------------------------------------------------

  it('fills missing keys from defaults', async () => {
    provider.rawConfig = {};
    const config = await provider.getConfig();

    expect(config).toEqual(DEFAULT_GCODE_CONFIG);
  });

  it('overrides only specified keys', async () => {
    provider.rawConfig = { dialect: DialectType.SIEMENS };
    const config = await provider.getConfig();

    expect(config.dialect).toBe(DialectType.SIEMENS);
    expect(config.formatter).toEqual(DEFAULT_GCODE_CONFIG.formatter);
    expect(config.visualizer).toEqual(DEFAULT_GCODE_CONFIG.visualizer);
    expect(config.extractor).toEqual(DEFAULT_GCODE_CONFIG.extractor);
  });

  it('deeply merges nested objects', async () => {
    provider.rawConfig = {
      formatter: {
        addLineNumbers: true,
        lineNumberStart: 100,
      },
    };
    const config = await provider.getConfig();

    expect(config.formatter.addLineNumbers).toBe(true);
    expect(config.formatter.lineNumberStart).toBe(100);
    // Other formatter fields should be defaults
    expect(config.formatter.lineNumberIncrement).toBe(
      DEFAULT_GCODE_CONFIG.formatter.lineNumberIncrement
    );
    expect(config.formatter.prettyPrintCommands).toBe(
      DEFAULT_GCODE_CONFIG.formatter.prettyPrintCommands
    );
  });

  it('replaces primitive values outright', async () => {
    provider.rawConfig = {
      visualizer: {
        rapidColor: '#ff0000',
        lineThickness: 3,
      },
    };
    const config = await provider.getConfig();

    expect(config.visualizer.rapidColor).toBe('#ff0000');
    expect(config.visualizer.lineThickness).toBe(3);
    // Other visualizer fields should be defaults
    expect(config.visualizer.feedColor).toBe(DEFAULT_GCODE_CONFIG.visualizer.feedColor);
  });

  it('merges extractor config with nested machineHome', async () => {
    provider.rawConfig = {
      extractor: {
        machineHome: { x: 10, y: 20, z: 30 },
      },
    };
    const config = await provider.getConfig();

    expect(config.extractor.machineHome).toEqual({ x: 10, y: 20, z: 30 });
    expect(config.interpreter.maxIterations).toBe(DEFAULT_GCODE_CONFIG.interpreter.maxIterations);
  });

  it('ignores undefined values in partial config', async () => {
    provider.rawConfig = {
      dialect: undefined,
      formatter: undefined,
    };
    const config = await provider.getConfig();

    expect(config.dialect).toBe(DEFAULT_GCODE_CONFIG.dialect);
    expect(config.formatter).toEqual(DEFAULT_GCODE_CONFIG.formatter);
  });
});
