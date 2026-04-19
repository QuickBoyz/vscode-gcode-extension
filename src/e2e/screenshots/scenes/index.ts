import { Scene } from '../lib/Scene';
import { SyntaxScene } from './01-syntax';
import { HoverScene } from './02-hover';
import { CompletionScene } from './03-completion';
import { FormatScene } from './04-format';
import { VisualizerBasicScene } from './05-visualizer-basic';
import { VisualizerComplexScene } from './06-visualizer-complex';
import { PlaybackScene } from './07-playback';
import { ErrorsScene } from './08-errors';
import { SymbolsScene } from './09-symbols';
import { HeroScene } from './11-hero';

/** Factory that returns all scenes in capture order. */
export function createAllScenes(repoRoot: string): Scene[] {
  return [
    new SyntaxScene(repoRoot),
    new HoverScene(repoRoot),
    new CompletionScene(repoRoot),
    new FormatScene(repoRoot),
    new VisualizerBasicScene(repoRoot),
    new VisualizerComplexScene(repoRoot),
    new PlaybackScene(repoRoot),
    new ErrorsScene(repoRoot),
    new SymbolsScene(repoRoot),
    new HeroScene(repoRoot),
  ];
}
