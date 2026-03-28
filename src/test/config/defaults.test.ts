import { DialectType } from '../../constants';
import { DEFAULT_GCODE_CONFIG } from '../../config';
import { ProjectionMode } from '../../shared/visualizerTypes';

describe('DEFAULT_GCODE_CONFIG', () => {
  // ---------------------------------------------------------------------------
  // Structure
  // ---------------------------------------------------------------------------

  it('has all required top-level fields', () => {
    expect(DEFAULT_GCODE_CONFIG).toHaveProperty('dialect');
    expect(DEFAULT_GCODE_CONFIG).toHaveProperty('formatter');
    expect(DEFAULT_GCODE_CONFIG).toHaveProperty('visualizer');
    expect(DEFAULT_GCODE_CONFIG).toHaveProperty('extractor');
  });

  it('has all required formatter fields', () => {
    const formatter = DEFAULT_GCODE_CONFIG.formatter;
    expect(formatter).toHaveProperty('addLineNumbers');
    expect(formatter).toHaveProperty('lineNumberStart');
    expect(formatter).toHaveProperty('lineNumberIncrement');
    expect(formatter).toHaveProperty('prettyPrintCommands');
    expect(formatter).toHaveProperty('prettyPrintNumbers');
    expect(formatter).toHaveProperty('indentSize');
    expect(formatter).toHaveProperty('useTabs');
    expect(formatter).toHaveProperty('indent');
    expect(formatter).toHaveProperty('compactOutput');
    expect(formatter).toHaveProperty('addProgramDelimiters');
  });

  it('has all required visualizer fields', () => {
    const visualizer = DEFAULT_GCODE_CONFIG.visualizer;
    expect(visualizer).toHaveProperty('rapidColor');
    expect(visualizer).toHaveProperty('feedColor');
    expect(visualizer).toHaveProperty('arcColor');
    expect(visualizer).toHaveProperty('lineThickness');
    expect(visualizer).toHaveProperty('showGrid');
    expect(visualizer).toHaveProperty('gridSpacing');
    expect(visualizer).toHaveProperty('showRapidMoves');
    expect(visualizer).toHaveProperty('projection');
  });

  it('has all required extractor fields', () => {
    const extractor = DEFAULT_GCODE_CONFIG.extractor;
    expect(extractor).toHaveProperty('machineHome');
    expect(extractor.machineHome).toHaveProperty('x');
    expect(extractor.machineHome).toHaveProperty('y');
    expect(extractor.machineHome).toHaveProperty('z');
  });

  it('has all required interpreter fields', () => {
    const interpreter = DEFAULT_GCODE_CONFIG.interpreter;
    expect(interpreter).toHaveProperty('maxIterations');
  });

  // ---------------------------------------------------------------------------
  // Values match package.json defaults
  // ---------------------------------------------------------------------------

  it('dialect defaults to linuxcnc', () => {
    expect(DEFAULT_GCODE_CONFIG.dialect).toBe(DialectType.LINUXCNC);
  });

  it('formatter defaults match package.json', () => {
    const formatter = DEFAULT_GCODE_CONFIG.formatter;
    expect(formatter.addLineNumbers).toBe(false);
    expect(formatter.lineNumberStart).toBe(10);
    expect(formatter.lineNumberIncrement).toBe(10);
    expect(formatter.prettyPrintCommands).toBe(true);
    expect(formatter.prettyPrintNumbers).toBe(true);
    expect(formatter.indentSize).toBe(2);
    expect(formatter.useTabs).toBe(false);
    expect(formatter.indent).toBe(true);
    expect(formatter.compactOutput).toBe(false);
    expect(formatter.addProgramDelimiters).toBe(true);
  });

  it('visualizer defaults match package.json', () => {
    const visualizer = DEFAULT_GCODE_CONFIG.visualizer;
    expect(visualizer.rapidColor).toBe('#ff6b6b');
    expect(visualizer.feedColor).toBe('#4ecdc4');
    expect(visualizer.arcColor).toBe('#45b7d1');
    expect(visualizer.lineThickness).toBe(1);
    expect(visualizer.showGrid).toBe(true);
    expect(visualizer.gridSpacing).toBe(10);
    expect(visualizer.showRapidMoves).toBe(true);
    expect(visualizer.projection).toBe(ProjectionMode.PERSPECTIVE);
  });

  it('extractor defaults match package.json', () => {
    const extractor = DEFAULT_GCODE_CONFIG.extractor;
    expect(extractor.machineHome).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('interpreter defaults match package.json', () => {
    const interpreter = DEFAULT_GCODE_CONFIG.interpreter;
    expect(interpreter.maxIterations).toBe(10_000);
  });
});
