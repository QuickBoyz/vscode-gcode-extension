# Testing Guide

This document provides detailed information about testing the G-Code Language Support extension.

## Test Architecture

The project uses a two-tier testing approach:

1. **Unit Tests (Jest)** - Fast, isolated tests for individual components
2. **E2E Tests (VS Code)** - Integration tests running in VS Code Extension Development Host

## Unit Tests

### Overview

Unit tests are located in `src/test/` and test individual components in isolation using Jest.

**Tested Components:**

- Parser (`GCodeParser.test.ts`)
- Formatter (`GCodeFormatter.test.ts`)
- AST Traverser (`AstTraverser.test.ts`)
- Document State Manager (`DocumentStateManager.test.ts`)
- Symbol Provider (`DocumentSymbolProvider.test.ts`)
- Highlight Provider (`DocumentHighlightProvider.test.ts`)
- Rename Provider (`RenameProvider.test.ts`, `RenameUtils.test.ts`)
- Variable Symbol Collector (`VariableSymbolCollector.test.ts`)
- Server (`server.test.ts`)

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run in watch mode (reruns on file changes)
npm run test:watch

# Run specific test file
npm test -- GCodeFormatter.test.ts

# Run with coverage
npm test -- --coverage
```

### Writing Unit Tests

Unit tests follow Jest conventions:

```typescript
import { describe, it, expect } from '@jest/globals';
import { GCodeParser } from '../parser/GCodeParser';

describe('GCodeParser', () => {
  it('should parse simple G-code command', () => {
    const parser = new GCodeParser('G01 X10');
    const ast = parser.parseProgram();

    expect(ast.statements).toHaveLength(1);
    expect(ast.statements[0].type).toBe('MotionCommand');
  });
});
```

**Unit Test Guidelines:**

- Test one thing per test case
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Mock external dependencies
- Keep tests fast and isolated

## E2E Tests

### Overview

E2E tests are located in `src/e2e/` and test the extension running in a real VS Code instance.

**Test Suites:**

- `extension.test.ts` - Extension activation and basic functionality
- `configuration.test.ts` - Configuration settings and updates
- `formatting.test.ts` - Document and range formatting
- `documentSymbol.test.ts` - Document symbol provider (outline)
- `documentHighlight.test.ts` - Symbol highlighting
- `rename.test.ts` - Variable renaming
- `semanticTokens.test.ts` - Semantic token provider (syntax coloring)

### Running E2E Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run both unit and e2e tests
npm run test:all
```

### E2E Test Structure

```
src/e2e/
├── suite/              # Test suites
│   ├── index.ts        # Test runner configuration
│   ├── extension.test.ts
│   ├── formatting.test.ts
│   └── ...
├── fixtures/           # Test G-code files
│   ├── simple.nc
│   ├── complex.nc
│   ├── variables.nc
│   └── empty.nc
├── runTest.ts          # E2E test entry point
└── testUtils.ts        # Shared test utilities
```

### Writing E2E Tests

E2E tests use the `@vscode/test-electron` framework:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { TestUtils } from '../testUtils';

suite('My Feature Tests', () => {
  TestUtils.setup(); // Sets up before/after hooks

  test('Should perform feature action', async () => {
    const document = await TestUtils.openGCodeDocument('simple.nc');

    const result = await vscode.commands.executeCommand(
      'vscode.executeDocumentSymbolProvider',
      document.uri
    );

    assert.ok(result);
    assert.equal(result.length, 3);
  });
});
```

**E2E Test Utilities:**

The `TestUtils` class provides helper methods:

```typescript
// Open a fixture file
const doc = await TestUtils.openGCodeDocument('simple.nc');

// Create temporary document
await TestUtils.withTestDocument(
  'G01 X10\nG02 Y20',
  async (document) => {
    // Test with document
  },
  'temp-test.nc'
);

// Wait for extension activation
await TestUtils.waitForExtensionActivation();

// Update configuration
await TestUtils.updateConfig('gcode.formatter.indent', true);
```

### Debugging E2E Tests

**Method 1: VS Code Launch Configuration**

1. Open `.vscode/launch.json`
2. Select "Extension Tests" configuration
3. Set breakpoints in test files
4. Press `F5` to start debugging

**Method 2: Manual Launch**

```bash
# Build the extension
npm run build:e2e

# Run tests with node inspector
NODE_OPTIONS="--inspect-brk" npm run test:e2e
```

Then attach a debugger to the Node process.

## Test Fixtures

### Unit Test Fixtures

Located in `src/test/fixtures/`:

- `test1.nc`, `test2.nc`, `test3.nc` - G-code samples
- `result1.json`, `result2.json`, `result3.json` - Expected parser outputs

### E2E Test Fixtures

Located in `src/e2e/fixtures/`:

- `simple.nc` - Basic G-code commands
- `complex.nc` - Advanced features (loops, conditionals)
- `variables.nc` - Variable assignments and references
- `empty.nc` - Empty file for edge cases

## Continuous Integration

Tests run automatically on:

- Pull requests
- Commits to main branch
- Release tags

**CI Pipeline:**

1. Install dependencies
2. Type check (`npm run typecheck`)
3. Build (`npm run build`)
4. Run unit tests (`npm test`)
5. Run e2e tests (`npm run test:e2e`)

## Test Coverage

Generate coverage report:

```bash
npm test -- --coverage
```

Coverage report is generated in `coverage/` directory.

**Coverage Goals:**

- Overall: >80%
- Parser: >90%
- Formatter: >90%
- Providers: >80%

## Troubleshooting

### E2E Tests Fail to Start

**Issue:** VS Code doesn't launch

**Solutions:**

- Delete `.vscode-test/` directory and re-run
- Update `@vscode/test-electron` version
- Check VS Code version compatibility

### E2E Tests Timeout

**Issue:** Tests hang or timeout

**Solutions:**

- Increase timeout in test configuration
- Check for infinite loops in code
- Ensure async operations are properly awaited

### Unit Tests Fail After Refactoring

**Issue:** Tests fail after code changes

**Solutions:**

- Update test expectations
- Check if interfaces changed
- Verify mock implementations

## Best Practices

### General

- Write tests before fixing bugs (TDD)
- Keep tests independent and isolated
- Use descriptive test names
- Test both success and failure cases

### Unit Tests

- Mock external dependencies
- Test edge cases and error conditions
- Keep tests fast (<100ms each)

### E2E Tests

- Use realistic G-code samples
- Test user workflows, not implementation details
- Clean up temporary files/state
- Handle async operations properly

## Resources

- [Jest Documentation](https://jestjs.io/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Mocha Test Framework](https://mochajs.org/) (used by VS Code tests)

---

For questions or issues with testing, open an issue on GitHub.
