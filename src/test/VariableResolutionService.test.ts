import {
  VariableEnvironment,
  VariableResolutionService,
} from '../visualizer/VariableResolutionService';

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
  // Edge cases
  // ---------------------------------------------------------------------------

  it('handles empty settings', () => {
    const service = new VariableResolutionService({
      settingsVariables: {},
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

  it('ignores NaN and Infinity values from settings', () => {
    const service = new VariableResolutionService({
      settingsVariables: {
        '#100': NaN,
        '#200': Infinity,
        '#300': -Infinity,
        '#400': 42,
      },
    });
    const env = service.resolve();

    expect(env.peek(100)).toBeNull();
    expect(env.peek(200)).toBeNull();
    expect(env.peek(300)).toBeNull();
    expect(env.peek(400)).toBe(42);
  });
});

describe('VariableEnvironment', () => {
  it('set() overwrites an unpinned seeded value', () => {
    const env = new VariableEnvironment();
    env.seed(100, 25.4);

    env.set(100, 99.9);

    expect(env.peek(100)).toBe(99.9);
  });

  it('set() on a pinned key is silently ignored', () => {
    const env = new VariableEnvironment();
    env.seed(100, 25.4, true);

    env.set(100, 99.9);

    expect(env.peek(100)).toBe(25.4);
  });

  it('settings variables are pinned by resolve()', () => {
    const service = new VariableResolutionService({
      settingsVariables: { '#100': 25.4 },
    });
    const env = service.resolve();

    // Program assignment should not overwrite the pinned settings value
    env.set(100, 99.9);

    expect(env.peek(100)).toBe(25.4);
  });

  it('reset() restores initial snapshot values and clears access tracking', () => {
    const env = new VariableEnvironment();
    env.seed(100, 25.4);
    env.seed('feed', 500);

    // Mutate via set and track via get
    env.set(100, 99.9);
    env.get(100);
    env.get('feed');

    expect(env.peek(100)).toBe(99.9);
    expect(env.referencedKeys.size).toBe(2);

    env.reset();

    // Values restored to initial snapshot
    expect(env.peek(100)).toBe(25.4);
    expect(env.peek('feed')).toBe(500);
    // Access tracking cleared
    expect(env.referencedKeys.size).toBe(0);
  });

  it('referencedKeys tracks keys accessed via get() but not via peek()', () => {
    const env = new VariableEnvironment();
    env.seed(100, 25.4);
    env.seed(200, 50.0);
    env.seed('feed', 500);

    env.get(100);
    env.get('feed');
    env.peek(200);

    expect(env.referencedKeys.has(100)).toBe(true);
    expect(env.referencedKeys.has('feed')).toBe(true);
    expect(env.referencedKeys.has(200)).toBe(false);
    expect(env.referencedKeys.size).toBe(2);
  });
});
