import { CropRegion } from './Scene';

/** Editor pane only — no sidebar, no chrome. Shared by all editor-focused scenes. */
export const EDITOR_CROP: CropRegion = { left: 48, top: 35, width: 1872, height: 1023 };

/** Right-side visualizer panel (editor on left, visualizer on right). */
export const VISUALIZER_CROP: CropRegion = { left: 1000, top: 35, width: 920, height: 1023 };

/** Outline sidebar + leftmost editor column for symbol scenes. */
export const OUTLINE_CROP: CropRegion = { left: 0, top: 35, width: 500, height: 1023 };
