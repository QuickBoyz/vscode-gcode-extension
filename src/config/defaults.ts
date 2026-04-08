/**
 * Default configuration values for the G-code extension.
 *
 * These defaults match the values declared in `package.json`
 * under `contributes.configuration.properties`.
 */

import { DialectType } from '../constants';
import { ProjectionMode } from '../visualizer/types';
import { GCodeConfig } from './types';

/**
 * Default configuration for the entire G-code extension.
 *
 * Every field has a sensible default so the extension works
 * out of the box without any user configuration.
 */
export const DEFAULT_GCODE_CONFIG: GCodeConfig = {
  dialect: DialectType.LINUXCNC,

  formatter: {
    addLineNumbers: false,
    lineNumberStart: 10,
    lineNumberIncrement: 10,
    prettyPrintCommands: true,
    prettyPrintNumbers: true,
    indentSize: 2,
    useTabs: false,
    indent: true,
    compactOutput: false,
    addProgramDelimiters: true,
  },

  visualizer: {
    rapidColor: '#ff6b6b',
    feedColor: '#4ecdc4',
    arcColor: '#f0e68c',
    lineThickness: 1,
    showGrid: true,
    gridSpacing: 10,
    showRapidMoves: true,
    projection: ProjectionMode.PERSPECTIVE,
    playback: {
      rapidSpeed: 10000,
      defaultFeedRate: 1000,
      followSourceLine: false,
    },
  },

  extractor: {
    machineHome: { x: 0, y: 0, z: 0 },
  },

  interpreter: {
    maxIterations: 10_000,
  },

  variables: {},

  workspace: {
    indexingEnabled: true,
    maxSymbols: 10_000,
  },
};
