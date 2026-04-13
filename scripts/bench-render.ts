/**
 * Headless render-loop benchmark for the G-code visualizer.
 *
 * Parses a fixture .ngc file, builds the typed-array GeometryCache,
 * then simulates N rAF frames of (projectBatch → painter's sort →
 * bucketed Path2D batching) against counting mock Canvas2D / Path2D
 * objects. Reports median and p95 frame time plus the number of
 * stroke() calls the render loop produced per frame — the latter is
 * the single clearest proxy for whether the batching path is healthy.
 *
 * Usage:
 *   npx ts-node --project tsconfig.build.json scripts/bench-render.ts
 *   npx ts-node --project tsconfig.build.json scripts/bench-render.ts path/to/other.ngc
 *
 * Default fixture: src/test/fixtures/surface-finish.ngc (~190k segments).
 */

import * as fs from 'fs';
import * as path from 'path';

import { GCodeLexer } from '../src/lexer/GCodeLexer';
import { LinuxCNCParser } from '../src/parser/dialects/LinuxCNCParser';
import { GCodeInterpreter } from '../src/visualizer/GCodeInterpreter';
import { GCodePathExtractor } from '../src/visualizer/GCodePathExtractor';
import { ProjectionMode } from '../src/visualizer/types';
import { GeometryCache, FrameScratch } from '../src/webview/geometryCache';
import { projectBatch, createCameraState } from '../src/webview/projection';
import { StyleBucket } from '../src/webview/renderBuckets';

const DEFAULT_FIXTURE = path.resolve(
  __dirname,
  '..',
  'src',
  'test',
  'fixtures',
  'surface-finish.ngc'
);
const FRAMES = Number(process.env.BENCH_FRAMES ?? 120);
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1000;

interface BenchCounters {
  strokeCalls: number;
  moveToCalls: number;
  lineToCalls: number;
  path2dCreated: number;
}

function createMockCtx(counters: BenchCounters) {
  return {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    lineCap: '',
    lineJoin: '',
    shadowColor: '',
    shadowBlur: 0,
    clearRect(): void {},
    fillRect(): void {},
    beginPath(): void {},
    moveTo(): void {
      counters.moveToCalls++;
    },
    lineTo(): void {
      counters.lineToCalls++;
    },
    stroke(_p?: unknown): void {
      counters.strokeCalls++;
    },
    save(): void {},
    restore(): void {},
    setLineDash(): void {},
  };
}

function installPath2D(counters: BenchCounters): void {
  class BenchPath2D {
    constructor() {
      counters.path2dCreated++;
    }
    moveTo(): void {
      counters.moveToCalls++;
    }
    lineTo(): void {
      counters.lineToCalls++;
    }
  }
  (globalThis as unknown as { Path2D: unknown }).Path2D = BenchPath2D;
}

function median(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function parseSegments(fixturePath: string) {
  const source = fs.readFileSync(fixturePath, 'utf8');
  const t0 = performance.now();
  const lexer = new GCodeLexer();
  const tokens = lexer.tokenize(source);
  const parser = new LinuxCNCParser(tokens, source);
  const ast = parser.parseProgram();
  const extractor = new GCodePathExtractor();
  const interpreter = new GCodeInterpreter(extractor);
  const toolPath = extractor.extract(ast, interpreter);
  const parseMs = performance.now() - t0;
  return { segments: toolPath.segments, parseMs, source };
}

function renderFrame(
  geometry: GeometryCache,
  scratch: FrameScratch,
  theta: number,
  ctx: ReturnType<typeof createMockCtx>
): number {
  const camera = { ...createCameraState(), theta };
  projectBatch(
    geometry.worldPoints,
    geometry.pointCount,
    camera,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    ProjectionMode.PERSPECTIVE,
    scratch.screen,
    scratch.pointDepth
  );

  const { segmentCount, segmentStart, segmentLength, segmentBucket, segmentMidpoint } = geometry;
  const { pointDepth, segmentDepth, sortedSegments, screen } = scratch;

  let drawnCount = 0;
  for (let i = 0; i < segmentCount; i++) {
    const midDepth = pointDepth[segmentMidpoint[i]];
    segmentDepth[i] = midDepth < 0.01 ? Infinity : midDepth;
    sortedSegments[drawnCount++] = i;
  }

  const drawList = sortedSegments.subarray(0, drawnCount);
  drawList.sort((a, b) => segmentDepth[b] - segmentDepth[a]);

  let currentBucket = -1;
  let currentAlpha = -1;
  let currentPath: { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void } | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Path2DCtor = (globalThis as any).Path2D;

  const flush = () => {
    if (currentPath === null) return;
    ctx.stroke(currentPath);
  };

  for (let d = 0; d < drawnCount; d++) {
    const segIdx = drawList[d];
    const bucket = segmentBucket[segIdx];
    const isRapid = bucket === StyleBucket.RAPID;
    const alphaState = isRapid ? 1 : 0;
    if (bucket !== currentBucket || alphaState !== currentAlpha) {
      flush();
      currentBucket = bucket;
      currentAlpha = alphaState;
      currentPath = new Path2DCtor();
    }
    const start = segmentStart[segIdx];
    const length = segmentLength[segIdx];
    const end = start + length;
    let pathStarted = false;
    for (let p = start; p < end; p++) {
      const sBase = p * 2;
      const x = screen[sBase];
      if (x !== x) {
        pathStarted = false;
        continue;
      }
      const y = screen[sBase + 1];
      if (!pathStarted) {
        currentPath!.moveTo(x, y);
        pathStarted = true;
      } else {
        currentPath!.lineTo(x, y);
      }
    }
  }
  flush();

  return drawnCount;
}

function main(): void {
  const fixturePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_FIXTURE;
  if (!fs.existsSync(fixturePath)) {
    // eslint-disable-next-line no-console
    console.error(`Fixture not found: ${fixturePath}`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`Fixture: ${fixturePath}`);
  const stat = fs.statSync(fixturePath);
  // eslint-disable-next-line no-console
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KiB`);

  const { segments, parseMs, source } = parseSegments(fixturePath);
  // eslint-disable-next-line no-console
  console.log(`Lines: ${source.split('\n').length}`);
  // eslint-disable-next-line no-console
  console.log(`Parse + extract: ${parseMs.toFixed(1)} ms`);
  // eslint-disable-next-line no-console
  console.log(`Segments: ${segments.length}`);

  const tCache0 = performance.now();
  const geometry = GeometryCache.build(segments);
  const cacheMs = performance.now() - tCache0;
  const scratch = FrameScratch.forCache(geometry);
  // eslint-disable-next-line no-console
  console.log(`GeometryCache build: ${cacheMs.toFixed(1)} ms (${geometry.pointCount} points)`);

  const counters: BenchCounters = {
    strokeCalls: 0,
    moveToCalls: 0,
    lineToCalls: 0,
    path2dCreated: 0,
  };
  installPath2D(counters);
  const ctx = createMockCtx(counters);

  // Warm-up frame: triggers JIT tiering + fills caches.
  renderFrame(geometry, scratch, 0, ctx);
  const warmupStrokes = counters.strokeCalls;

  const frameTimes: number[] = [];
  const counterBefore = { ...counters };
  for (let f = 0; f < FRAMES; f++) {
    const theta = (f / FRAMES) * Math.PI * 2;
    const t0 = performance.now();
    renderFrame(geometry, scratch, theta, ctx);
    frameTimes.push(performance.now() - t0);
  }

  const sorted = [...frameTimes].sort((a, b) => a - b);
  const med = median(sorted);
  const p95 = percentile(sorted, 0.95);
  const avg = frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length;
  const fpsFromMedian = 1000 / med;

  const strokesAfter = counters.strokeCalls - counterBefore.strokeCalls;
  const path2dAfter = counters.path2dCreated - counterBefore.path2dCreated;
  const strokesPerFrame = strokesAfter / FRAMES;
  const path2dPerFrame = path2dAfter / FRAMES;

  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log(`Frames: ${FRAMES}`);
  // eslint-disable-next-line no-console
  console.log(`Median frame: ${med.toFixed(2)} ms  (${fpsFromMedian.toFixed(1)} fps)`);
  // eslint-disable-next-line no-console
  console.log(`P95 frame:    ${p95.toFixed(2)} ms`);
  // eslint-disable-next-line no-console
  console.log(`Mean frame:   ${avg.toFixed(2)} ms`);
  // eslint-disable-next-line no-console
  console.log(`Warm-up frame strokes: ${warmupStrokes}`);
  // eslint-disable-next-line no-console
  console.log(`Stroke calls / frame: ${strokesPerFrame.toFixed(1)}`);
  // eslint-disable-next-line no-console
  console.log(`Path2D allocs / frame: ${path2dPerFrame.toFixed(1)}`);
}

main();
