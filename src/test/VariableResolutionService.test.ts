import { VariableResolutionService } from '../visualizer/VariableResolutionService';

describe('VariableResolutionService', () => {
  // ---------------------------------------------------------------------------
  // Basic construction
  // ---------------------------------------------------------------------------

  it('creates an empty variable environment with no inputs', () => {
    const service = new VariableResolutionService();
    const env = service.resolve();

    // Empty environment — arbitrary keys should return null
    expect(env.peek(100)).toBeNull();
    expect(env.peek('any_var')).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Settings defaults
  // ---------------------------------------------------------------------------

  it('includes variables from settings defaults', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#100': 25.4, '#<tool_diameter>': 6.35 },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBe(25.4);
    expect(env.peek('tool_diameter')).toBe(6.35);
  });

  it('handles numeric variable keys without # prefix', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '100': 25.4 },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBe(25.4);
  });

  it('handles named variable keys without # and angle brackets', () => {
    const service = new VariableResolutionService({
      settingsVariables: { tool_diameter: 6.35 },
    });
    const env = service.resolve();

    expect(env.peek('tool_diameter')).toBe(6.35);
  });

  // ---------------------------------------------------------------------------
  // Runtime overrides
  // ---------------------------------------------------------------------------

  it('includes variables from runtime overrides', () => {
    const service = new VariableResolutionService({
      runtimeOverrides: { '#100': 50.0 },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBe(50.0);
  });

  // ---------------------------------------------------------------------------
  // Precedence: runtime override > settings > default (0)
  // ---------------------------------------------------------------------------

  it('runtime overrides take precedence over settings defaults', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#100': 25.4 },
      runtimeOverrides: { '#100': 50.0 },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBe(50.0);
  });

  it('settings values are used when no runtime override exists', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#100': 25.4, '#200': 10.0 },
      runtimeOverrides: { '#100': 50.0 },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBe(50.0);
    expect(env.peek(200)).toBe(10.0);
  });

  // ---------------------------------------------------------------------------
  // Variable key normalization
  // ---------------------------------------------------------------------------

  it('normalizes #<name> format to string name', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#<my_var>': 42 },
    });
    const env = service.resolve();

    expect(env.peek('my_var')).toBe(42);
  });

  it('normalizes #123 format to numeric key', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#123': 99 },
    });
    const env = service.resolve();

    expect(env.peek(123)).toBe(99);
  });

  it('normalizes named variable keys case-insensitively', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#<Tool_Diameter>': 6.35 },
    });
    const env = service.resolve();

    expect(env.peek('tool_diameter')).toBe(6.35);
  });

  // ---------------------------------------------------------------------------
  // Merging settings and overrides
  // ---------------------------------------------------------------------------

  it('merges settings and runtime overrides for different variables', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#100': 25.4 },
      runtimeOverrides: { '#<tool_diameter>': 6.35 },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBe(25.4);
    expect(env.peek('tool_diameter')).toBe(6.35);
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  it('handles empty settings and overrides', () => {
    const service = new VariableResolutionService({
      settingsVariables: {},
      runtimeOverrides: {},
    });
    const env = service.resolve();

    // Empty environment — arbitrary keys should return null
    expect(env.peek(100)).toBeNull();
    expect(env.peek('any_var')).toBeNull();
  });

  it('handles zero values correctly', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#100': 0 },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBe(0);
  });

  it('handles negative values correctly', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#100': -25.4 },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBe(-25.4);
  });

  it('ignores invalid variable key formats', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '': 42, '###': 99 },
    });
    const env = service.resolve();

    // Invalid keys should not be present
    expect(env.peek(0)).toBeNull();
    expect(env.peek('any_var')).toBeNull();
  });

  it('ignores non-numeric values from manually-edited settings', () => {
    const service = new VariableResolutionService({
      settingsVariables: {
        '#100': 25.4,
        '#200': 'not a number' as unknown as number,
        '#300': true as unknown as number,
        '#<name>': undefined as unknown as number,
      },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBe(25.4);
    // Non-numeric values should have been ignored
    expect(env.peek(200)).toBeNull();
    expect(env.peek(300)).toBeNull();
    expect(env.peek('name')).toBeNull();
  });
});
