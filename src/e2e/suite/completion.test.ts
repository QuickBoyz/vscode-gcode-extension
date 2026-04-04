/**
 * Completion Provider E2E Tests
 *
 * Integration tests for code completion functionality in VS Code Extension Development Host
 */

import * as assert from 'assert';
import * as vscode from 'vscode';

import { TestUtils } from '../testUtils';

suite('Completion Provider E2E Tests', () => {
  TestUtils.setup();

  test('Should provide G-code completions for G prefix', async () => {
    await TestUtils.withTestDocument(
      'G',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 1) // After 'G'
        );

        assert.ok(completions, 'Expected completion results');
        assert.ok(completions.items.length > 0, 'Expected completion items');

        // All items should be G-codes
        const allGCodes = completions.items.every((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label.startsWith('G');
        });
        assert.ok(allGCodes, 'Expected all G-code completions');

        // Should include G00, G01, G02, etc.
        const hasG00 = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'G00';
        });
        const hasG01 = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'G01';
        });
        assert.ok(hasG00, 'Expected G00 completion');
        assert.ok(hasG01, 'Expected G01 completion');
      },
      'completion-gcode.nc'
    );
  });

  test('Should provide M-code completions for M prefix', async () => {
    await TestUtils.withTestDocument(
      'M',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 1) // After 'M'
        );

        assert.ok(completions, 'Expected completion results');
        assert.ok(completions.items.length > 0, 'Expected completion items');

        // All items should be M-codes
        const allMCodes = completions.items.every((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label.startsWith('M');
        });
        assert.ok(allMCodes, 'Expected all M-code completions');

        // Should include M00, M01, M03, etc.
        const hasM00 = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'M00';
        });
        const hasM03 = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'M03';
        });
        assert.ok(hasM00, 'Expected M00 completion');
        assert.ok(hasM03, 'Expected M03 completion');
      },
      'completion-mcode.nc'
    );
  });

  test('Should filter commands by partial prefix', async () => {
    await TestUtils.withTestDocument(
      'G0',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 2) // After 'G0'
        );

        assert.ok(completions, 'Expected completion results');
        assert.ok(completions.items.length > 0, 'Expected completion items');

        // All items should start with G0
        const allG0Codes = completions.items.every((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label.startsWith('G0');
        });
        assert.ok(allG0Codes, 'Expected all G0x completions');

        // Should NOT include G17, G18, etc.
        const hasG17 = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'G17';
        });
        assert.ok(!hasG17, 'Should not include G17');
      },
      'completion-partial.nc'
    );
  });

  test('Should provide axis parameter completions after G-code', async () => {
    await TestUtils.withTestDocument(
      'G01 ',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 4) // After 'G01 '
        );

        assert.ok(completions, 'Expected completion results');
        assert.ok(completions.items.length > 0, 'Expected completion items');

        // Should include X, Y, Z parameters
        const hasX = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'X';
        });
        const hasY = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'Y';
        });
        const hasZ = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'Z';
        });
        const hasF = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'F';
        });

        assert.ok(hasX, 'Expected X parameter');
        assert.ok(hasY, 'Expected Y parameter');
        assert.ok(hasZ, 'Expected Z parameter');
        assert.ok(hasF, 'Expected F parameter');
      },
      'completion-params.nc'
    );
  });

  test('Should filter out already-used parameters', async () => {
    await TestUtils.withTestDocument(
      'G01 X10 Y20 ',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 12) // After 'G01 X10 Y20 '
        );

        assert.ok(completions, 'Expected completion results');

        // X and Y should not be in suggestions
        const hasX = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'X';
        });
        const hasY = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'Y';
        });
        assert.ok(!hasX, 'X should be filtered out');
        assert.ok(!hasY, 'Y should be filtered out');

        // But Z should still be available
        const hasZ = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'Z';
        });
        assert.ok(hasZ, 'Expected Z parameter');
      },
      'completion-filter-params.nc'
    );
  });

  test('Should provide variable completions after # symbol', async () => {
    await TestUtils.withTestDocument(
      '#<x> = 10\n#<y> = 20\n#',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(2, 1) // After '#' on line 3
        );

        assert.ok(completions, 'Expected completion results');
        assert.ok(completions.items.length > 0, 'Expected completion items');

        // Should include defined variables
        const hasX = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === '#<x>';
        });
        const hasY = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === '#<y>';
        });
        assert.ok(hasX, 'Expected #<x> variable');
        assert.ok(hasY, 'Expected #<y> variable');
      },
      'completion-variables.nc'
    );
  });

  test('Should provide numeric variable completions', async () => {
    await TestUtils.withTestDocument(
      '#100 = 5\n#200 = 10\n#',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(2, 1) // After '#' on line 3
        );

        assert.ok(completions, 'Expected completion results');

        const has100 = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === '#100';
        });
        const has200 = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === '#200';
        });
        assert.ok(has100, 'Expected #100 variable');
        assert.ok(has200, 'Expected #200 variable');
      },
      'completion-numeric-vars.nc'
    );
  });

  test('Should provide function completions in expression context', async () => {
    await TestUtils.withTestDocument(
      'X[',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 2) // After 'X['
        );

        assert.ok(completions, 'Expected completion results');
        assert.ok(completions.items.length > 0, 'Expected completion items');

        // Should include math functions
        const hasSIN = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'SIN';
        });
        const hasCOS = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'COS';
        });
        const hasABS = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'ABS';
        });
        const hasSQRT = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'SQRT';
        });

        assert.ok(hasSIN, 'Expected SIN function');
        assert.ok(hasCOS, 'Expected COS function');
        assert.ok(hasABS, 'Expected ABS function');
        assert.ok(hasSQRT, 'Expected SQRT function');
      },
      'completion-functions.nc'
    );
  });

  test('Should filter functions by prefix', async () => {
    await TestUtils.withTestDocument(
      'X[SI',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 4) // After 'X[SI'
        );

        assert.ok(completions, 'Expected completion results');

        const hasSIN = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'SIN';
        });
        assert.ok(hasSIN, 'Expected SIN function');

        // Should not include COS
        const hasCOS = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'COS';
        });
        assert.ok(!hasCOS, 'Should not include COS function');
      },
      'completion-filter-functions.nc'
    );
  });

  test('Should provide mixed completions in expression context', async () => {
    await TestUtils.withTestDocument(
      '#<x> = 10\nY[#<x> + ',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(1, 10) // After 'Y[#<x> + '
        );

        assert.ok(completions, 'Expected completion results');
        assert.ok(completions.items.length > 0, 'Expected completion items');

        // Should have variables
        const hasVar = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === '#<x>';
        });
        // Should have functions
        const hasFunc = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'SIN';
        });
        // Should have operators
        const hasOp = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'EQ' || label === 'NE';
        });

        assert.ok(hasVar, 'Expected variable completions');
        assert.ok(hasFunc, 'Expected function completions');
        assert.ok(hasOp, 'Expected operator completions');
      },
      'completion-expression.nc'
    );
  });

  test('Should provide command details in completion items', async () => {
    await TestUtils.withTestDocument(
      'G01',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 3) // After 'G01'
        );

        assert.ok(completions, 'Expected completion results');

        const g01 = completions.items.find((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'G01';
        });
        assert.ok(g01, 'Expected G01 completion item');
        assert.ok(g01.detail, 'Expected detail text');
        assert.ok(
          g01.detail?.toString().includes('G01'),
          'Expected G01 parameter signature in detail'
        );
      },
      'completion-details.nc'
    );
  });

  test('Should provide completions with fixture file', async () => {
    const document = await TestUtils.openGCodeDocument('simple.nc');

    // Try to get completions at end of file
    const lastLine = document.lineCount - 1;
    const lastChar = document.lineAt(lastLine).text.length;

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      document.uri,
      new vscode.Position(lastLine, lastChar)
    );

    // Should return completions or empty list (not null/undefined)
    assert.ok(completions !== null && completions !== undefined, 'Expected completion result');
  });

  test('Should handle lowercase command prefix', async () => {
    await TestUtils.withTestDocument(
      'g',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 1)
        );

        assert.ok(completions, 'Expected completion results');
        assert.ok(completions.items.length > 0, 'Expected completion items');

        // Should still provide G-code completions (case insensitive)
        const hasG00 = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'G00';
        });
        assert.ok(hasG00, 'Expected G00 completion for lowercase g');
      },
      'completion-lowercase.nc'
    );
  });

  test('Should provide completions on trigger characters', async () => {
    await TestUtils.withTestDocument(
      'G01 X10 ',
      async (document) => {
        // Trigger on space character
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 8), // After space
          ' ' // Trigger character
        );

        assert.ok(completions, 'Expected completion results');
        // Should provide parameter completions
        const hasParam = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'Y' || label === 'Z';
        });
        assert.ok(hasParam, 'Expected parameter completions on space trigger');
      },
      'completion-trigger.nc'
    );
  });

  test('Should handle empty document gracefully', async () => {
    const document = await TestUtils.openGCodeDocument('empty.nc');

    const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      document.uri,
      new vscode.Position(0, 0)
    );

    // Should return result (empty or not) without error
    assert.ok(completions !== null && completions !== undefined, 'Expected completion result');
  });

  test('Should provide completions for circular interpolation parameters', async () => {
    await TestUtils.withTestDocument(
      'G02 ',
      async (document) => {
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          'vscode.executeCompletionItemProvider',
          document.uri,
          new vscode.Position(0, 4)
        );

        assert.ok(completions, 'Expected completion results');

        // G02 should suggest I, J, K (arc parameters) and R (radius)
        const hasI = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'I';
        });
        const hasJ = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'J';
        });
        const hasR = completions.items.some((item) => {
          const label = typeof item.label === 'string' ? item.label : item.label.label;
          return label === 'R';
        });

        assert.ok(hasI, 'Expected I parameter for G02');
        assert.ok(hasJ, 'Expected J parameter for G02');
        assert.ok(hasR, 'Expected R parameter for G02');
      },
      'completion-g02-params.nc'
    );
  });
});
