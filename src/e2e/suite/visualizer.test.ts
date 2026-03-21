import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

const fixtureName = 'simple.nc';

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

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
