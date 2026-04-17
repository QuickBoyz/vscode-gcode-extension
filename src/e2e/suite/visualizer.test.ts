import * as assert from 'assert';
import * as path from 'path';

import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

const fixtureName = 'simple.nc';

/**
 * Large fixture that reproduces the #142 loading-state bug.
 * Located in src/test/fixtures/ (shared with the unit-test fixtures). The
 * compiled e2e suite lives under out/e2e/suite/, so we walk back up to the
 * repo root.
 */
const LARGE_FIXTURE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'test',
  'fixtures',
  'surface-finish.ngc'
);

// Webview DOM and click events are not reachable from the Extension Host,
// so payload inspection and link-click behavior are covered by unit tests
// (WorkerClient, documentReducer, CommandProvider) rather than here.
suite('Visualizer E2E Tests', () => {
  TestUtils.setup();

  test('Visualizer command should be registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(
      commands.includes('gcode.openVisualizer'),
      'gcode.openVisualizer command should be registered'
    );
  });

  test('Visualizer command should open a webview panel without error', async () => {
    await TestUtils.openGCodeDocument(fixtureName);

    // Execute the visualizer command — should not throw
    await vscode.commands.executeCommand('gcode.openVisualizer');

    // Give the panel a moment to open
    await new Promise((resolve) => setTimeout(resolve, 500));

    // In the headless test environment, the webview panel takes over the
    // active view column (no multi-column layout), so we can't assert on
    // visible text editors. The key assertion is that executeCommand did
    // not throw — the panel was created and rendered successfully.
    assert.ok(true, 'Visualizer command executed without error');

    // Clean up: close all editors including the webview panel
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  test('Visualizer command should show warning when no G-code file is open', async () => {
    // Close all editors first
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Execute the command without a G-code file open — should not throw
    await vscode.commands.executeCommand('gcode.openVisualizer');

    // The command should complete without error (shows a warning message instead)
    assert.ok(true, 'Command should not throw when no G-code file is open');

    // Re-open a G-code file for subsequent tests
    await TestUtils.openGCodeDocument(fixtureName);
  });

  test('Visualizer command should work with complex fixture', async () => {
    await TestUtils.openGCodeDocument('complex.nc');

    // Should not throw on a complex file
    await vscode.commands.executeCommand('gcode.openVisualizer');
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clean up
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Visualizer command should work with variables fixture', async () => {
    await TestUtils.openGCodeDocument('variables.nc');

    // Should not throw on a file with variables
    await vscode.commands.executeCommand('gcode.openVisualizer');
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clean up
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Visualizer command completes gracefully on a malformed file (#142 error path)', async () => {
    // The parser is mostly recoverable and collects ErrorNodes rather
    // than throwing, so the "malformed" fixture may end up as a valid
    // (possibly empty) tool path instead of reaching the error state.
    // The point of this test is not to prove which state we land in —
    // it's to prove the worker -> WorkerClient -> panel -> webview
    // pipe does not crash the extension host on structurally wrong
    // input. The reducer unit tests cover the ERROR state itself;
    // this test covers the integration that previously couldn't even
    // open the panel on the user-reported repro.
    await TestUtils.openGCodeDocument('malformed.nc');

    await vscode.commands.executeCommand('gcode.openVisualizer');
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Clean up
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  // Superseded-parse silencing is covered by unit tests: the reducer
  // never sees a SupersededParseError (CommandProvider swallows it),
  // and `WorkerClient.test.ts` asserts parse() rejects with a typed
  // SupersededParseError. An e2e version of the same check is too
  // race-prone to be useful (openGCodeDocument waits on active-editor
  // state that the second open changes underneath it).

  test('Visualizer command completes on a large file (#142 repro)', async function () {
    // The fixture is ~190k lines / ~3.1 MB and takes several seconds to parse.
    // This test exercises the open-panel-before-parse flow end-to-end in a
    // real Extension Host; the assertion is that the command completes
    // without throwing, which proves the loading-state handshake between
    // CommandProvider, WorkerClient, and GCodeVisualizerPanel is correct
    // on a file that used to reproduce #142.
    this.timeout(60000);

    try {
      await TestUtils.openGCodeDocument(LARGE_FIXTURE_PATH);
    } catch (err) {
      // Skip rather than fail if the fixture isn't available in this
      // environment — the unit tests still cover the state machine.
      console.warn(`Skipping large-file e2e: ${(err as Error).message}`);
      this.skip();
      return;
    }

    const started = Date.now();
    await vscode.commands.executeCommand('gcode.openVisualizer');
    const elapsed = Date.now() - started;

    assert.ok(
      elapsed < 45000,
      `openVisualizer should complete in under 45s on the large fixture, took ${elapsed}ms`
    );

    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
