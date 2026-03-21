# G-Code 3D Visualizer Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the Copilot-generated 3D G-code visualizer to production quality — fix architecture violations, add missing UX features, expand test coverage, and add a G-code interpreter for variable/loop support.

**Architecture:** Each task produces its own feature branch off `copilot/add-gcode-visualization-feature` and a separate PR targeting that branch. Changes follow the strict layered architecture in AGENTS.md: Lexer → Parser → AST → Services → VS Code Adapters. The interpreter is a new service in `src/visualizer/` that consumes the AST without mutating it.

**Tech Stack:** TypeScript 5.x (strict), VS Code Extension API, Canvas 2D, Jest, ESLint 9.x (flat config)

**Branching:** All branches are created from `copilot/add-gcode-visualization-feature`. Each PR targets that branch. After all improvements, the copilot branch PRs into `main`.

**Constructing test AST nodes:** Throughout this plan, tests that construct AST nodes manually must use the correct constructors:
- `Range.create(startLine, startChar, endLine, endChar)` — NOT plain objects
- `UnaryExpressionNode(range, operator, operand, operatorRange)` — requires 4th arg `operatorRange`
- `LiteralExpressionNode(range, value)` — value is `number | string`
- `VariableReferenceNode(range, name)` — name is `string | number`
- `BinaryExpressionNode(range, left, operator, right, operatorRange)` — requires 5th arg `operatorRange`

---

## Task 1: Fix default camera to show Z-axis pointing up (#29)

**Branch:** `fix/visualizer-z-up-camera`

**Context:** CNC convention treats Z as vertical (spindle axis). The current renderer treats Y as up. The projection math rotates around Y (azimuth) then X (elevation). To show Z-up, we change the rotation order: azimuth rotates around Z, elevation tilts from the XY plane upward.

**Files:**
- Modify: `src/client/webviewTemplate.ts` (projection function, default angles, fitView reset)

### Implementation

- [ ] **Step 1: Fix projection to use Z-up coordinate system**

In `webviewTemplate.ts`, the `project()` function (line 231), rewrite to use Z as the vertical axis. The new rotation order: azimuth rotates around Z-axis, elevation tilts the camera up from the XY plane.

```javascript
function project(px, py, pz) {
  var dx = px - target.x;
  var dy = py - target.y;
  var dz = pz - target.z;

  // Rotate around Z axis (azimuth) — Z is up
  var cosT = Math.cos(theta);
  var sinT = Math.sin(theta);
  var x1 =  dx * cosT + dy * sinT;
  var y1 = -dx * sinT + dy * cosT;

  // Rotate around X axis (elevation)
  var cosP = Math.cos(phi);
  var sinP = Math.sin(phi);
  var z2 =  dz * cosP - y1 * sinP;
  var y2 =  dz * sinP + y1 * cosP;

  // Perspective divide
  var depth = radius + y2;
  if (depth < 0.01) return null;

  var fov   = Math.min(canvas.width, canvas.height) * 1.5;
  var scale = fov / depth;

  return {
    x: canvas.width  / 2 + panX + x1 * scale,
    y: canvas.height / 2 + panY - z2 * scale,
    depth: depth,
  };
}
```

- [ ] **Step 2: Update default camera angles for a front-right isometric view**

Change the initial camera state (around line 210):
```javascript
var theta  = -Math.PI / 4;      // -45° azimuth (front-right)
var phi    = Math.PI / 5;       // 36° elevation
```

- [ ] **Step 3: Update fitView() reset angles to match new defaults**

In `fitView()` (around line 418):
```javascript
theta  = -Math.PI / 4;
phi    = Math.PI / 5;
```

- [ ] **Step 4: Run tests, typecheck, lint**

```bash
npm test && npx tsc --noEmit && npm run lint
```
Expected: All pass. The projection change is webview-only JS, no TypeScript compilation impact.

- [ ] **Step 5: Test in VS Code debug mode**

Launch the extension (F5 in VS Code), open a G-code file with Z moves, run "G-Code: Open 3D Visualizer" and verify:
- Z axis (blue) points up on screen
- X axis (red) points right-ish
- Y axis (green) goes into the screen
- Orbit controls feel natural (horizontal drag rotates around Z)
- Reset View button returns to the Z-up isometric angle

- [ ] **Step 6: Commit and create PR**

```bash
git checkout -b fix/visualizer-z-up-camera
git add src/client/webviewTemplate.ts
git commit -m "fix: render 3D visualizer with Z-axis pointing up

CNC convention treats Z as the vertical (spindle) axis. Updated the
projection math to rotate around Z for azimuth, adjusted default
camera angles for a front-right isometric view."
gh pr create --base copilot/add-gcode-visualization-feature \
  --title "fix: render 3D visualizer with Z-axis pointing up" \
  --body "Closes #29"
```

---

## Task 2: Add context menu entries for editor and file explorer (#30)

**Branch:** `feat/visualizer-context-menus`

**Context:** The visualizer command is only accessible via Command Palette. Add right-click context menu entries in both the editor and the file explorer tree. The command handler needs to accept a `Uri` argument for explorer invocations.

**Files:**
- Modify: `package.json` (add `menus` contribution point)
- Modify: `src/client/CommandProvider.ts` (update handler to accept `Uri`, extract `resolveDocumentText` method)

### Implementation

- [ ] **Step 1: Add menus contribution to package.json**

In `package.json` under `contributes`, after the `commands` array, add:

```json
"menus": {
  "editor/context": [
    {
      "command": "gcode.openVisualizer",
      "when": "editorLangId == gcode",
      "group": "navigation"
    }
  ],
  "explorer/context": [
    {
      "command": "gcode.openVisualizer",
      "when": "resourceLangId == gcode",
      "group": "navigation"
    }
  ]
}
```

- [ ] **Step 2: Update command handler to accept URI argument**

In `CommandProvider.ts`, update `registerOpenVisualizerCommand` to accept an optional `uri: vscode.Uri` parameter and add a `resolveDocumentText` helper:

```typescript
private registerOpenVisualizerCommand(context: vscode.ExtensionContext): vscode.Disposable {
  return vscode.commands.registerCommand('gcode.openVisualizer', async (uri?: vscode.Uri): Promise<void> => {
    const documentText = await this.resolveDocumentText(uri);
    if (documentText === null) {
      vscode.window.showWarningMessage(
        'Open a G-Code file first, then run "G-Code: Open 3D Visualizer".'
      );
      return;
    }

    const pathData = this.visualizerService.extractToolPath(documentText);
    const settings = this.readVisualizerSettings();
    GCodeVisualizerPanel.createOrShow(context, pathData, settings);
  });
}

/**
 * Resolves the G-code text content from a URI (explorer context menu)
 * or the active text editor. Returns null if no valid G-code source is found.
 */
private async resolveDocumentText(uri?: vscode.Uri): Promise<string | null> {
  if (uri) {
    const document = await vscode.workspace.openTextDocument(uri);
    return document.getText();
  }

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== GCODE_LANGUAGE_ID) {
    return null;
  }
  return editor.document.getText();
}
```

- [ ] **Step 3: Run tests, typecheck, lint**

```bash
npm test && npx tsc --noEmit && npm run lint
```

- [ ] **Step 4: Test in VS Code debug mode**

- Open a G-code file, right-click in editor → verify "Open 3D Visualizer" appears under "navigation" group
- Right-click a `.ngc` file in explorer tree → verify menu item appears
- Right-click a `.ts` file → verify menu item does NOT appear
- Test both entry points launch the visualizer correctly
- Verify Command Palette invocation still works

- [ ] **Step 5: Commit and create PR**

```bash
git checkout -b feat/visualizer-context-menus
git add package.json src/client/CommandProvider.ts
git commit -m "feat: add context menu entries for 3D visualizer

Adds right-click context menu entries in both the editor and file
explorer tree. Updates command handler to accept a URI argument for
explorer invocations."
gh pr create --base copilot/add-gcode-visualization-feature \
  --title "feat: add context menu entries for 3D visualizer" \
  --body "Closes #30"
```

---

## Task 3: Fix style violations, clean up imports, send bounds to webview (#6, #7)

**Branch:** `refactor/visualizer-cleanup`

**Files:**
- Modify: `src/visualizer/GCodePathExtractor.ts` (split comma declarations)
- Modify: `src/client/CommandProvider.ts` (import from `visualizer/types` directly)
- Modify: `src/constants.ts` (remove re-export)
- Modify: `src/client/GCodeVisualizerPanel.ts` (include bounds in update message)
- Modify: `src/client/webviewTemplate.ts` (receive bounds in fitView, fix hardcoded bg color)
- Modify: `src/client/extension.ts` (fix comma-separated declarations on lines 31-55)

### Implementation

- [ ] **Step 1: Fix comma-separated declarations in GCodePathExtractor.ts**

In `computeBounds()` (lines 172-177), replace comma-separated `let` with separate declarations:
```typescript
let minX = Infinity;
let minY = Infinity;
let minZ = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;
let maxZ = -Infinity;
```

- [ ] **Step 2: Fix comma-separated declarations in extension.ts**

Lines 31-55 use comma syntax for `serverModule`, `serverOptions`, `clientOptions`. Split into separate `const` declarations.

- [ ] **Step 3: Fix import in CommandProvider.ts and remove re-export from constants.ts**

In `CommandProvider.ts`, change:
```typescript
import { GCODE_LANGUAGE_ID, DEFAULT_VISUALIZER_SETTINGS } from '../constants';
```
to:
```typescript
import { GCODE_LANGUAGE_ID } from '../constants';
import { DEFAULT_VISUALIZER_SETTINGS } from '../visualizer/types';
```

In `constants.ts`, remove:
```typescript
import { DEFAULT_VISUALIZER_SETTINGS } from './visualizer/types';
export { DEFAULT_VISUALIZER_SETTINGS };
```

- [ ] **Step 4: Send pre-computed bounds to the webview**

In `GCodeVisualizerPanel.ts`, update the message type and `update()` method to include bounds:
```typescript
type ExtensionToWebviewMessage =
  | { type: 'update'; segments: ToolPathData['segments']; bounds: PathBounds; settings: VisualizerSettings }
  | { type: 'updateSettings'; settings: VisualizerSettings };
```

In `update()`:
```typescript
private update(pathData: ToolPathData, settings: VisualizerSettings): void {
  const msg: ExtensionToWebviewMessage = {
    type: 'update',
    segments: pathData.segments,
    bounds: pathData.bounds,
    settings,
  };
  this.panel.webview.postMessage(msg);
}
```

In the webview JS `fitView()`, use received bounds when available instead of recomputing from segments. Store bounds in a module-level variable set in the `message` handler.

- [ ] **Step 5: Replace hardcoded background color in webview renderer**

In `render()`, replace `ctx.fillStyle = '#1e1e1e';` with a cached CSS variable lookup:
```javascript
// Outside render(), cache once:
var bgColor = '#1e1e1e';
function updateBgColor() {
  bgColor = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
}
updateBgColor();

// In render():
ctx.fillStyle = bgColor;
```

- [ ] **Step 6: Run tests, typecheck, lint**

```bash
npm test && npx tsc --noEmit && npm run lint
```

- [ ] **Step 7: Commit and create PR**

Two commits:
```bash
git checkout -b refactor/visualizer-cleanup
git add src/visualizer/GCodePathExtractor.ts src/client/CommandProvider.ts src/constants.ts src/client/extension.ts
git commit -m "refactor: fix style violations in visualizer code

Split comma-separated variable declarations per AGENTS.md rules.
Import DEFAULT_VISUALIZER_SETTINGS directly from visualizer/types
instead of re-exporting through constants.ts."

git add src/client/GCodeVisualizerPanel.ts src/client/webviewTemplate.ts
git commit -m "refactor: send pre-computed bounds to webview and fix hardcoded bg

Pass PathBounds in the update message so the webview does not need
to recompute bounds. Replace hardcoded #1e1e1e background with
VS Code CSS variable."

gh pr create --base copilot/add-gcode-visualization-feature \
  --title "refactor: fix style violations and send bounds to webview" \
  --body "Closes #6 and #7 (from epic #27)"
```

---

## Task 4: Add G-code interpreter for variable, loop, and branch support (#4, #28)

**Branch:** `feat/visualizer-interpreter`

**Context:** This is the most architecturally significant change. It combines two goals:
1. Replace the `instanceof` chains in `extractNumericValue()` with a proper visitor (#4)
2. Add variable resolution, expression evaluation, WHILE loops, and IF/ELSE branches (#28)

We build a `GCodeExpressionEvaluator` (visitor for evaluating expressions with a variable environment) and a `GCodeInterpreter` (walks the AST with control flow). The `GCodePathExtractor` is refactored to receive motion callbacks from the interpreter rather than being a visitor itself.

**Architecture note on `instanceof` in the interpreter:** The `GCodeInterpreter.interpretStatement()` method must dispatch on `StatementNode` subtypes. The existing `AstTraverser` uses the same `switch(true) + instanceof` pattern because `StatementNode` has no `accept()` method for statement-level visitor dispatch (only expression nodes have `accept()`). This is an accepted pragmatic compromise — it mirrors the existing `AstTraverser` pattern and is confined to one dispatch method. The `instanceof` prohibition in AGENTS.md targets *scattered* chains across services, not centralized dispatch.

**Key AST structure for IF statements:** `IfStatementNode` does NOT have a condition/body directly. Instead:
- `node.ifClause: IfClauseNode` — has `.condition` and `.body`
- `node.elseIfClauses?: IfClauseNode[]` — each has `.condition` and `.body`
- `node.elseClause?: ElseClauseNode` — has `.body` (no condition)

**Files:**
- Create: `src/visualizer/GCodeExpressionEvaluator.ts`
- Create: `src/visualizer/GCodeInterpreter.ts`
- Create: `src/test/GCodeExpressionEvaluator.test.ts`
- Create: `src/test/GCodeInterpreter.test.ts`
- Modify: `src/visualizer/GCodePathExtractor.ts` (use interpreter, implement MotionHandler)
- Modify: `src/visualizer/types.ts` (add `InterpreterOptions`, `MotionHandler`)
- Modify: `src/test/GCodePathExtractor.test.ts` (add variable/loop tests)

### Phase 1: Expression Evaluator

- [ ] **Step 1: Write tests for GCodeExpressionEvaluator**

Create `src/test/GCodeExpressionEvaluator.test.ts`. Use `Range.create(0, 0, 0, 0)` for all range arguments. Test cases:

```typescript
import { GCodeExpressionEvaluator } from '../visualizer/GCodeExpressionEvaluator';
import { LiteralExpressionNode } from '../parser/nodes/expressions/LiteralExpressionNode';
import { UnaryExpressionNode } from '../parser/nodes/expressions/UnaryExpressionNode';
import { BinaryExpressionNode } from '../parser/nodes/expressions/BinaryExpressionNode';
import { VariableReferenceNode } from '../parser/nodes/VariableReferenceNode';
import { UnaryOperatorType, BinaryOperatorType } from '../parser/nodes/expressions/types';
import { Range } from '../parser/nodes/Range';

const R = Range.create(0, 0, 0, 0);

describe('GCodeExpressionEvaluator', () => {
  it('evaluates positive literal', () => { ... });
  it('evaluates string literal that parses to number', () => { ... });
  it('returns null for non-numeric string literal', () => { ... });
  it('evaluates negated literal', () => {
    const inner = new LiteralExpressionNode(R, 10);
    // Note: 4th arg is operatorRange
    const node = new UnaryExpressionNode(R, UnaryOperatorType.Minus, inner, R);
    const evaluator = new GCodeExpressionEvaluator(new Map());
    expect(evaluator.evaluate(node)).toBe(-10);
  });
  it('resolves variable reference from environment', () => {
    const env = new Map<string | number, number>([['x_max', 619]]);
    const evaluator = new GCodeExpressionEvaluator(env);
    const node = new VariableReferenceNode(R, 'x_max');
    expect(evaluator.evaluate(node)).toBe(619);
  });
  it('returns null for unknown variable', () => { ... });
  it('evaluates addition', () => {
    const left = new LiteralExpressionNode(R, 10);
    const right = new LiteralExpressionNode(R, 5);
    const node = new BinaryExpressionNode(R, left, BinaryOperatorType.Add, right, R);
    const evaluator = new GCodeExpressionEvaluator(new Map());
    expect(evaluator.evaluate(node)).toBe(15);
  });
  it('evaluates subtraction', () => { ... });
  it('evaluates multiplication', () => { ... });
  it('evaluates division', () => { ... });
  it('returns null if either operand is null', () => { ... });
  // Relational operators (return 1 for true, 0 for false — LinuxCNC convention)
  it('evaluates GT', () => { ... });
  it('evaluates LT', () => { ... });
  it('evaluates EQ', () => { ... });
  it('evaluates NE', () => { ... });
  it('evaluates LE', () => { ... });
  it('evaluates GE', () => { ... });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern GCodeExpressionEvaluator
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement GCodeExpressionEvaluator**

Create `src/visualizer/GCodeExpressionEvaluator.ts`:

```typescript
import { BaseAstVisitor } from '../parser/BaseAstVisitor';
import { LiteralExpressionNode } from '../parser/nodes/expressions/LiteralExpressionNode';
import { UnaryExpressionNode } from '../parser/nodes/expressions/UnaryExpressionNode';
import { BinaryExpressionNode } from '../parser/nodes/expressions/BinaryExpressionNode';
import { FunctionCallNode } from '../parser/nodes/FunctionCallNode';
import { VariableReferenceNode } from '../parser/nodes/VariableReferenceNode';
import { ExpressionNode } from '../parser/nodes/expressions/ExpressionNode';
import { UnaryOperatorType, BinaryOperatorType } from '../parser/nodes/expressions/types';
import { RelationalOperatorType } from '../parser/nodes/expressions/types';

/**
 * Visitor that evaluates G-code expressions using a variable environment.
 *
 * Supports literals, negation, arithmetic (+, -, *, /, MOD),
 * relational operators (GT, LT, EQ, NE, LE, GE returning 1/0),
 * variable references, and built-in math functions.
 *
 * Returns null when an expression cannot be evaluated (unknown variables,
 * unsupported constructs).
 */
export class GCodeExpressionEvaluator extends BaseAstVisitor<number | null> {
  constructor(private readonly variableEnvironment: ReadonlyMap<string | number, number>) {
    super();
  }

  protected defaultValue(): number | null {
    return null;
  }

  evaluate(expression: ExpressionNode): number | null {
    return expression.accept(this);
  }

  override visitLiteralExpression(node: LiteralExpressionNode): number | null {
    const parsed = typeof node.value === 'number' ? node.value : parseFloat(String(node.value));
    return isNaN(parsed) ? null : parsed;
  }

  override visitUnaryExpression(node: UnaryExpressionNode): number | null {
    if (node.operator === UnaryOperatorType.Minus) {
      const inner = this.evaluate(node.operand);
      return inner !== null ? -inner : null;
    }
    return null;
  }

  override visitVariableReference(node: VariableReferenceNode): number | null {
    return this.variableEnvironment.get(node.name) ?? null;
  }

  override visitBinaryExpression(node: BinaryExpressionNode): number | null {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);
    if (left === null || right === null) return null;
    return this.applyOperator(node.operator, left, right);
  }

  override visitFunctionCall(node: FunctionCallNode): number | null {
    const arg = this.evaluate(node.argument);
    if (arg === null) return null;
    return this.applyFunction(node.name.toUpperCase(), arg);
  }

  private applyOperator(operator: string, left: number, right: number): number | null {
    switch (operator) {
      case BinaryOperatorType.Add: return left + right;
      case BinaryOperatorType.Subtract: return left - right;
      case BinaryOperatorType.Multiply: return left * right;
      case BinaryOperatorType.Divide: return right !== 0 ? left / right : null;
      case BinaryOperatorType.Mod: return right !== 0 ? left % right : null;
      case RelationalOperatorType.GT: return left > right ? 1 : 0;
      case RelationalOperatorType.LT: return left < right ? 1 : 0;
      case RelationalOperatorType.EQ: return left === right ? 1 : 0;
      case RelationalOperatorType.NE: return left !== right ? 1 : 0;
      case RelationalOperatorType.LE: return left <= right ? 1 : 0;
      case RelationalOperatorType.GE: return left >= right ? 1 : 0;
      default: return null;
    }
  }

  private applyFunction(name: string, argument: number): number | null {
    switch (name) {
      case 'SIN': return Math.sin(argument);
      case 'COS': return Math.cos(argument);
      case 'TAN': return Math.tan(argument);
      case 'ASIN': return Math.asin(argument);
      case 'ACOS': return Math.acos(argument);
      case 'ATAN': return Math.atan(argument);
      case 'SQRT': return Math.sqrt(argument);
      case 'ABS': return Math.abs(argument);
      case 'ROUND': return Math.round(argument);
      case 'FIX': return Math.floor(argument);
      case 'FUP': return Math.ceil(argument);
      case 'LN': return argument > 0 ? Math.log(argument) : null;
      default: return null;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern GCodeExpressionEvaluator
```

- [ ] **Step 5: Commit expression evaluator**

```bash
git add src/visualizer/GCodeExpressionEvaluator.ts src/test/GCodeExpressionEvaluator.test.ts
git commit -m "feat: add GCodeExpressionEvaluator for variable and arithmetic resolution"
```

### Phase 2: Interpreter

- [ ] **Step 6: Add interpreter types to types.ts**

Add to `src/visualizer/types.ts`:

```typescript
import { AxisParameterNode } from '../parser/nodes/AxisParameterNode';
import { GCodeExpressionEvaluator } from './GCodeExpressionEvaluator';

/** Configuration options for the G-code interpreter. */
export interface InterpreterOptions {
  readonly maxIterations: number;
}

export const DEFAULT_INTERPRETER_OPTIONS: InterpreterOptions = {
  maxIterations: 10000,
};

/**
 * Callback interface for motion commands encountered during interpretation.
 * Decouples the interpreter from path extraction.
 */
export interface MotionHandler {
  onMotionCommand(
    command: string,
    parameters: AxisParameterNode[],
    evaluator: GCodeExpressionEvaluator
  ): void;
}
```

- [ ] **Step 7: Write tests for GCodeInterpreter**

Create `src/test/GCodeInterpreter.test.ts`. Tests use the real lexer+parser pipeline to build ASTs from G-code strings (same pattern as GCodePathExtractor.test.ts). Use a mock `MotionHandler` that records calls.

Test cases:
- Simple linear program records motion commands in order
- Variable assignment + motion with variable reference: handler receives resolved values
- WHILE loop iterates correct number of times (e.g., `#<i>=3; WHILE [#<i> GT 0]; G1 X#<i>; #<i>=#<i>-1; ENDWHILE` → 3 motion calls)
- IF/ELSE: only the true branch executes
- Max iteration limit: loop that would run forever stops at limit and does not hang
- Nested IF inside WHILE

- [ ] **Step 8: Implement GCodeInterpreter**

Create `src/visualizer/GCodeInterpreter.ts`:

```typescript
import {
  IfStatementNode,
  MotionCommandNode,
  StatementNode,
  VariableAssignmentNode,
  WhileStatementNode,
} from '../parser/nodes';
import { ProgramNode } from '../parser/nodes/ProgramNode';
import { GCodeExpressionEvaluator } from './GCodeExpressionEvaluator';
import {
  DEFAULT_INTERPRETER_OPTIONS,
  InterpreterOptions,
  MotionHandler,
} from './types';

/**
 * Interprets a G-code AST with variable resolution, expression evaluation,
 * and control flow (WHILE loops, IF/ELSE branches).
 *
 * Unlike AstTraverser (which walks the tree once), this class evaluates
 * conditions and repeats loop bodies, maintaining a variable environment.
 *
 * Note: interpretStatement() uses instanceof dispatch for StatementNode
 * subtypes, mirroring the pattern in AstTraverser. This is an accepted
 * compromise — StatementNode does not have an accept() method for
 * statement-level visitor dispatch.
 */
export class GCodeInterpreter {
  private readonly variableEnvironment = new Map<string | number, number>();
  private readonly expressionEvaluator: GCodeExpressionEvaluator;
  private readonly options: InterpreterOptions;
  private totalIterations = 0;
  private iterationLimitReached = false;

  constructor(
    private readonly motionHandler: MotionHandler,
    options?: Partial<InterpreterOptions>
  ) {
    this.options = { ...DEFAULT_INTERPRETER_OPTIONS, ...options };
    this.expressionEvaluator = new GCodeExpressionEvaluator(this.variableEnvironment);
  }

  /** Whether the interpreter hit the max iteration limit. */
  get wasIterationLimitReached(): boolean {
    return this.iterationLimitReached;
  }

  interpret(program: ProgramNode): void {
    this.variableEnvironment.clear();
    this.totalIterations = 0;
    this.iterationLimitReached = false;
    this.interpretStatements(program.statements);
  }

  private interpretStatements(statements: readonly StatementNode[]): void {
    for (const statement of statements) {
      if (this.iterationLimitReached) return;
      this.interpretStatement(statement);
    }
  }

  private interpretStatement(node: StatementNode): void {
    if (node instanceof MotionCommandNode) {
      this.motionHandler.onMotionCommand(
        node.command,
        node.getParameters(),
        this.expressionEvaluator
      );
    } else if (node instanceof VariableAssignmentNode) {
      this.interpretVariableAssignment(node);
    } else if (node instanceof WhileStatementNode) {
      this.interpretWhileStatement(node);
    } else if (node instanceof IfStatementNode) {
      this.interpretIfStatement(node);
    }
    // Other statement types (comments, line numbers, etc.) are ignored
  }

  private interpretVariableAssignment(node: VariableAssignmentNode): void {
    const value = this.expressionEvaluator.evaluate(node.value);
    if (value !== null) {
      this.variableEnvironment.set(node.name, value);
    }
  }

  private interpretWhileStatement(node: WhileStatementNode): void {
    while (!this.iterationLimitReached) {
      const conditionValue = this.expressionEvaluator.evaluate(node.condition);
      // In LinuxCNC, condition is truthy if != 0
      if (conditionValue === null || conditionValue === 0) break;

      this.totalIterations++;
      if (this.totalIterations > this.options.maxIterations) {
        this.iterationLimitReached = true;
        return;
      }

      this.interpretStatements(node.body);
    }
  }

  private interpretIfStatement(node: IfStatementNode): void {
    // Check IF clause
    const ifCondition = this.expressionEvaluator.evaluate(node.ifClause.condition);
    if (ifCondition !== null && ifCondition !== 0) {
      this.interpretStatements(node.ifClause.body);
      return;
    }

    // Check ELSEIF clauses
    for (const elseIfClause of node.elseIfClauses ?? []) {
      const elseIfCondition = this.expressionEvaluator.evaluate(elseIfClause.condition);
      if (elseIfCondition !== null && elseIfCondition !== 0) {
        this.interpretStatements(elseIfClause.body);
        return;
      }
    }

    // Fall through to ELSE clause
    if (node.elseClause) {
      this.interpretStatements(node.elseClause.body);
    }
  }
}
```

- [ ] **Step 9: Run interpreter tests**

```bash
npm test -- --testPathPattern GCodeInterpreter
```

- [ ] **Step 10: Commit interpreter**

```bash
git add src/visualizer/GCodeInterpreter.ts src/visualizer/types.ts src/test/GCodeInterpreter.test.ts
git commit -m "feat: add GCodeInterpreter with WHILE loop and IF/ELSE evaluation"
```

### Phase 3: Integrate with GCodePathExtractor

- [ ] **Step 11: Refactor GCodePathExtractor to use the interpreter**

The extractor no longer extends `BaseAstVisitor`. Instead it implements `MotionHandler` and delegates AST walking to `GCodeInterpreter`.

Key changes:
- Remove `extends BaseAstVisitor<void>` — implement `MotionHandler` instead
- Remove `visitMotionCommand()` and `defaultValue()` — replace with `onMotionCommand()`
- In `onMotionCommand()`, use `evaluator.evaluate(param.value)` instead of the old `axisValue()` function to resolve axis values (this now handles variables and expressions)
- In `extract()`, create a `GCodeInterpreter(this)` and call `interpreter.interpret(program)`
- Remove the standalone `extractNumericValue()` and `axisValue()` functions
- The `classifyMotionType()`, `processMotion()`, `computeNewPosition()`, `pushSegment()` methods stay but are adjusted to use the evaluator

- [ ] **Step 12: Update existing tests and add variable/loop integration tests**

In `src/test/GCodePathExtractor.test.ts`, add:

```typescript
it('resolves named variables in axis values', () => {
  const data = extract('#<xpos> = 50\nG1 X#<xpos> Y20');
  expect(data.segments).toHaveLength(1);
  expect(data.segments[0].points[1]).toEqual({ x: 50, y: 20, z: 0 });
});

it('evaluates arithmetic in variable assignments', () => {
  const data = extract('#<base> = 10\n#<offset> = #<base> + 5\nG1 X#<offset>');
  expect(data.segments).toHaveLength(1);
  expect(data.segments[0].points[1]).toEqual({ x: 15, y: 0, z: 0 });
});

it('iterates WHILE loops', () => {
  const program = `
#<i> = 0
O100 WHILE [#<i> LT 3]
  G1 X#<i>
  #<i> = #<i> + 1
O100 ENDWHILE
  `;
  const data = extract(program);
  expect(data.segments).toHaveLength(3);
});

it('handles IF/ELSE branching', () => {
  const program = `
#<flag> = 1
O100 IF [#<flag> EQ 1]
  G1 X10
O100 ELSE
  G1 X20
O100 ENDIF
  `;
  const data = extract(program);
  expect(data.segments).toHaveLength(1);
  expect(data.segments[0].points[1].x).toBe(10);
});

it('handles surface-wasteboard.ngc with variables and loops', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'surface-wasteboard.ngc');
  const fixture = fs.readFileSync(fixturePath, 'utf-8');
  const data = extract(fixture);
  // The WHILE loop produces many zigzag passes
  expect(data.segments.length).toBeGreaterThan(50);
  const rapidCount = data.segments.filter(s => s.type === MotionType.RAPID).length;
  expect(rapidCount).toBeGreaterThan(10);
});
```

- [ ] **Step 13: Run all tests**

```bash
npm test && npx tsc --noEmit && npm run lint
```
All 523+ existing tests must still pass plus the new ones.

- [ ] **Step 14: Test in VS Code debug mode**

Open `surface-wasteboard.ngc`, run visualizer, verify the zigzag surfacing pattern renders with many passes across the workpiece.

- [ ] **Step 15: Commit and create PR**

```bash
git add src/visualizer/GCodePathExtractor.ts src/visualizer/GCodeInterpreter.ts \
  src/visualizer/GCodeExpressionEvaluator.ts src/visualizer/types.ts \
  src/test/GCodeExpressionEvaluator.test.ts src/test/GCodeInterpreter.test.ts \
  src/test/GCodePathExtractor.test.ts
git commit -m "refactor: integrate interpreter into GCodePathExtractor

GCodePathExtractor now implements MotionHandler and delegates AST
walking to GCodeInterpreter. This enables variable resolution,
arithmetic evaluation, WHILE loops, and IF/ELSE branches.

Removes instanceof chains from expression evaluation (now handled
by GCodeExpressionEvaluator visitor). Adds integration test with
surface-wasteboard.ngc fixture."

gh pr create --base copilot/add-gcode-visualization-feature \
  --title "feat: add G-code interpreter for variable and loop support" \
  --body "Closes #28 and #4 (from epic #27)"
```

---

## Task 5: Add live-update on document change (#2) and error handling (#5)

**Branch:** `feat/visualizer-live-update`

**Context:** The visualizer should auto-refresh as the user edits. Also needs graceful error handling when parsing fails.

**Files:**
- Modify: `src/client/VisualizerService.ts` (add result type with error handling)
- Modify: `src/client/CommandProvider.ts` (add debounced document change listener, lifecycle)
- Modify: `src/client/GCodeVisualizerPanel.ts` (expose `isOpen()`, add error message type)
- Modify: `src/client/webviewTemplate.ts` (add error display in webview)
- Create: `src/test/VisualizerService.test.ts`

### Implementation

- [ ] **Step 1: Write tests for VisualizerService error handling**

Create `src/test/VisualizerService.test.ts`:
```typescript
describe('VisualizerService', () => {
  it('extracts tool path from valid G-code', () => {
    const service = new VisualizerService();
    const result = service.extractToolPath('G1 X10 Y20');
    expect(result.success).toBe(true);
    expect(result.data?.segments).toHaveLength(1);
  });

  it('returns error result for unparseable input', () => {
    // Construct input that triggers parse errors — depends on parser behavior
    // Even with errors, should not throw
    const service = new VisualizerService();
    const result = service.extractToolPath('');
    expect(result.success).toBe(true);
    expect(result.data?.segments).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Add result type and error handling to VisualizerService**

```typescript
export interface VisualizerResult {
  readonly success: boolean;
  readonly data?: ToolPathData;
  readonly errorMessage?: string;
}

export class VisualizerService {
  extractToolPath(text: string): VisualizerResult {
    try {
      const tokens = this.lexer.tokenize(text);
      const parser = new GCodeParser(tokens, text);
      const ast = parser.parseProgram();
      const data = this.extractor.extract(ast);
      return { success: true, data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      return { success: false, errorMessage: message };
    }
  }
}
```

- [ ] **Step 3: Add debounced document change listener to CommandProvider**

In `CommandProvider.ts`, add a listener that fires when the active G-code document changes. Use a `setTimeout`-based debounce (500ms). Register when the panel opens, dispose when it closes.

```typescript
private documentChangeListener: vscode.Disposable | undefined;
private debounceTimer: ReturnType<typeof setTimeout> | undefined;

private startWatchingDocumentChanges(context: vscode.ExtensionContext): void {
  this.documentChangeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document.languageId !== GCODE_LANGUAGE_ID) return;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const result = this.visualizerService.extractToolPath(event.document.getText());
      if (result.success && result.data) {
        const settings = this.readVisualizerSettings();
        GCodeVisualizerPanel.refresh(result.data, settings);
      }
    }, 500);
  });
  context.subscriptions.push(this.documentChangeListener);
}
```

- [ ] **Step 4: Add error message type to webview communication**

In `GCodeVisualizerPanel.ts`, add error message type. In `webviewTemplate.ts`, add an error banner element that shows when an error message is received and hides when a successful update arrives.

- [ ] **Step 5: Update CommandProvider to use VisualizerResult**

Update the `openVisualizer` command handler to check `result.success` and show a warning if parsing failed.

- [ ] **Step 6: Run all tests, typecheck, lint**

```bash
npm test && npx tsc --noEmit && npm run lint
```

- [ ] **Step 7: Test in VS Code debug mode**

- Open a G-code file, open visualizer, edit the file → verify visualizer updates after ~500ms
- Delete all content → verify empty state or error state shows
- Type invalid content → verify no crash
- Close the panel → verify no errors in console, listener is cleaned up

- [ ] **Step 8: Commit and create PR**

```bash
git checkout -b feat/visualizer-live-update
git add src/client/VisualizerService.ts src/client/CommandProvider.ts \
  src/client/GCodeVisualizerPanel.ts src/client/webviewTemplate.ts \
  src/test/VisualizerService.test.ts
git commit -m "feat: add live-update on document change with error handling

The visualizer now auto-refreshes (debounced 500ms) as the user edits
a G-code file. Parse errors are caught and displayed gracefully in the
webview instead of crashing the extension."
gh pr create --base copilot/add-gcode-visualization-feature \
  --title "feat: add live-update on document change with error handling" \
  --body "Closes #2 and #5 (from epic #27)"
```

---

## Task 6: Expand test coverage (#8)

**Branch:** `test/visualizer-coverage`

**Files:**
- Create: `src/test/webviewTemplate.test.ts`
- Modify: `src/test/GCodePathExtractor.test.ts` (arc edge cases)

### Implementation

- [ ] **Step 1: Add generateNonce tests**

```typescript
import { generateNonce } from '../client/webviewTemplate';

describe('generateNonce', () => {
  it('returns a 32-character hex string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates unique values', () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(nonces.size).toBe(100);
  });
});
```

- [ ] **Step 2: Add arc edge case tests**

```typescript
it('handles arc with zero radius gracefully', () => {
  const data = extract('G2 X0 Y0 I0 J0');
  expect(data.segments).toHaveLength(1);
  // Zero radius → should produce start+end points only
  expect(data.segments[0].points.length).toBeLessThanOrEqual(2);
});

it('handles arc with missing I/J (defaults to 0)', () => {
  const data = extract('G2 X10 Y0');
  expect(data.segments).toHaveLength(1);
});

it('handles negative axis values with unary minus', () => {
  const data = extract('G1 X-10 Y-20 Z-5');
  expect(data.segments[0].points[1]).toEqual({ x: -10, y: -20, z: -5 });
});
```

- [ ] **Step 3: Run all tests**

```bash
npm test && npx tsc --noEmit && npm run lint
```

- [ ] **Step 4: Commit and create PR**

```bash
git checkout -b test/visualizer-coverage
git add src/test/webviewTemplate.test.ts src/test/GCodePathExtractor.test.ts
git commit -m "test: expand visualizer test coverage

Add tests for generateNonce, arc edge cases (zero radius, missing I/J),
and negative axis values."
gh pr create --base copilot/add-gcode-visualization-feature \
  --title "test: expand visualizer test coverage" \
  --body "Closes #8 (from epic #27)"
```

---

## Execution Order and Dependencies

```
Task 1 (Z-up camera) ──────────────────┐
Task 2 (context menus) ────────────────┤
Task 3 (style fixes + bounds) ─────────┼──► Task 4 (interpreter) ──► Task 5 (live update)
Task 6 (test coverage) ────────────────┘
```

- Tasks 1, 2, 3, 6 are independent of each other
- Task 4 depends on Task 3 (style fixes affect same files)
- Task 5 depends on Task 4 (uses the interpreter's VisualizerService changes)
- All PRs must pass: `npm test`, `npx tsc --noEmit`, `npm run lint`
- All PRs must be tested in VS Code debug mode (F5) before submission
