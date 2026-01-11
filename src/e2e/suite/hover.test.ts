/**
 * Hover Provider E2E Tests
 *
 * Integration tests for hover functionality in VS Code Extension Development Host
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

suite('Hover Provider E2E Tests', () => {
  TestUtils.setup();

  test('Should provide hover for variable declaration', async () => {
    await TestUtils.withTestDocument(
      '#<x> = 10\nG01 X#<x>',
      async (document) => {
        // Hover over variable name in declaration
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 2) // Position over 'x' in #<x>
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('Variable'), 'Expected variable hover');
        assert.ok(contentStr.includes('#<x>'), 'Expected variable name');
        assert.ok(contentStr.includes('10'), 'Expected variable value');
      },
      'hover-variable.nc'
    );
  });

  test('Should provide hover for variable reference', async () => {
    await TestUtils.withTestDocument(
      '#<speed> = 1000\nM03 S#<speed>',
      async (document) => {
        // Hover over variable reference in M03
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(1, 6) // Position over 'speed' in S#<speed>
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('Variable'), 'Expected variable hover');
        assert.ok(contentStr.includes('#<speed>'), 'Expected variable name');
        assert.ok(contentStr.includes('1000'), 'Expected variable value');
        assert.ok(contentStr.includes('Declared at'), 'Expected declaration location');
      },
      'hover-variable-ref.nc'
    );
  });

  test('Should provide hover for G01 command', async () => {
    const document = await TestUtils.openGCodeDocument('simple.nc');

    // Hover over G01 command
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      document.uri,
      new vscode.Position(0, 1) // Position over '01' in G01
    );

    assert.ok(hovers && hovers.length > 0, 'Expected hover results');
    const hover = hovers[0];
    const content = hover.contents[0];
    const contentStr =
      typeof content === 'string'
        ? content
        : content instanceof vscode.MarkdownString
          ? content.value
          : '';

    assert.ok(contentStr.includes('Linear Interpolation'), 'Expected G01 description');
    assert.ok(contentStr.includes('G01'), 'Expected command name');
    assert.ok(contentStr.includes('Motion'), 'Expected command group');
    assert.ok(contentStr.includes('Example'), 'Expected example usage');
  });

  test('Should provide hover for M03 spindle command', async () => {
    await TestUtils.withTestDocument(
      'M03 S1200',
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 1) // Position over M03
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('Spindle On Clockwise'), 'Expected M03 description');
        assert.ok(contentStr.includes('M03'), 'Expected command name');
        assert.ok(contentStr.includes('Spindle Control'), 'Expected command group');
      },
      'hover-m03.nc'
    );
  });

  test('Should provide hover for EQ operator', async () => {
    await TestUtils.withTestDocument(
      'IF [#<x> EQ 10] THEN\nG01 X10\nENDIF',
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 10) // Position over 'EQ'
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('Equal'), 'Expected operator name');
        assert.ok(contentStr.includes('EQ'), 'Expected operator symbol');
        assert.ok(contentStr.includes('relational'), 'Expected operator category');
        assert.ok(contentStr.includes('Example'), 'Expected example usage');
      },
      'hover-operator.nc'
    );
  });

  test('Should provide hover for GT operator', async () => {
    await TestUtils.withTestDocument(
      'IF [#<speed> GT 1000] THEN\nM05\nENDIF',
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 14) // Position over 'GT'
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('Greater Than'), 'Expected operator name');
        assert.ok(contentStr.includes('GT'), 'Expected operator symbol');
      },
      'hover-gt-operator.nc'
    );
  });

  test('Should provide hover for SIN function', async () => {
    await TestUtils.withTestDocument(
      '#<y> = SIN[30]',
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 8) // Position over 'SIN'
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('SIN[angle]'), 'Expected function signature');
        assert.ok(contentStr.includes('sine'), 'Expected function description');
        assert.ok(contentStr.includes('trigonometric'), 'Expected function category');
        assert.ok(contentStr.includes('Example'), 'Expected example usage');
      },
      'hover-sin-function.nc'
    );
  });

  test('Should provide hover for ABS function', async () => {
    await TestUtils.withTestDocument(
      '#<distance> = ABS[-10.5]',
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 15) // Position over 'ABS'
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('ABS[value]'), 'Expected function signature');
        assert.ok(contentStr.includes('absolute value'), 'Expected function description');
      },
      'hover-abs-function.nc'
    );
  });

  test('Should provide hover for X axis parameter', async () => {
    await TestUtils.withTestDocument(
      'G01 X10.0 Y20.0 F500',
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 4) // Position over 'X'
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('X-Axis'), 'Expected axis name');
        assert.ok(contentStr.includes('horizontal'), 'Expected axis description');
        assert.ok(contentStr.includes('10.0'), 'Expected parameter value');
        assert.ok(contentStr.includes('mm or inches'), 'Expected units');
      },
      'hover-x-axis.nc'
    );
  });

  test('Should provide hover for F feed rate parameter', async () => {
    await TestUtils.withTestDocument(
      'G01 X10 Y20 F500',
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 12) // Position over 'F'
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('Feed Rate'), 'Expected parameter name');
        assert.ok(contentStr.includes('F'), 'Expected parameter letter');
        assert.ok(contentStr.includes('500'), 'Expected parameter value');
      },
      'hover-feed-rate.nc'
    );
  });

  test('Should provide hover for S spindle speed parameter', async () => {
    await TestUtils.withTestDocument(
      'M03 S1200',
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 4) // Position over 'S'
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('Spindle Speed'), 'Expected parameter name');
        assert.ok(contentStr.includes('S'), 'Expected parameter letter');
        assert.ok(contentStr.includes('1200'), 'Expected parameter value');
        assert.ok(contentStr.includes('RPM'), 'Expected units');
      },
      'hover-spindle-speed.nc'
    );
  });

  test('Should return null for unknown command', async () => {
    await TestUtils.withTestDocument(
      'G999 X10', // Unknown G-code
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 1)
        );

        // Should return no hovers for unknown command
        assert.ok(!hovers || hovers.length === 0, 'Expected no hover for unknown command');
      },
      'hover-unknown-command.nc'
    );
  });

  test('Should handle hover in complex nested expressions', async () => {
    await TestUtils.withTestDocument(
      '#<result> = [#<a> + #<b>] * #<c>',
      async (document) => {
        // Hover over variable reference inside nested expression
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 14) // Position over 'a' in #<a>
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        // Should find the variable reference
        assert.ok(contentStr.includes('#<a>'), 'Expected variable reference');
      },
      'hover-nested-expression.nc'
    );
  });

  test('Should provide hover for addition operator in expression', async () => {
    await TestUtils.withTestDocument(
      '#<sum> = #<x> + #<y>',
      async (document) => {
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          document.uri,
          new vscode.Position(0, 14) // Position over '+'
        );

        assert.ok(hovers && hovers.length > 0, 'Expected hover results');
        const hover = hovers[0];
        const content = hover.contents[0];
        const contentStr =
          typeof content === 'string'
            ? content
            : content instanceof vscode.MarkdownString
              ? content.value
              : '';

        assert.ok(contentStr.includes('Addition'), 'Expected operator name');
        assert.ok(contentStr.includes('+'), 'Expected operator symbol');
      },
      'hover-addition-operator.nc'
    );
  });

  test('Should handle hover with variables fixture', async () => {
    const document = await TestUtils.openGCodeDocument('variables.nc');

    // Hover over a variable in the fixture
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      document.uri,
      new vscode.Position(0, 2) // Adjust position based on fixture content
    );

    // Should get hover results from the fixture
    assert.ok(hovers, 'Expected hover results from variables fixture');
  });
});
