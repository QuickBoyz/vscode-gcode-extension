# Contributing to G-Code Language Support

Thank you for your interest in contributing to the G-Code Language Support extension! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Be open to different perspectives

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- Visual Studio Code
- Basic knowledge of TypeScript and VS Code extension development

### Development Setup

1. **Fork and clone the repository:**

```bash
git clone https://github.com/YOUR_USERNAME/vscode-gcode-extension.git
cd vscode-gcode-extension
```

2. **Install dependencies:**

```bash
npm install
```

3. **Build the project:**

```bash
npm run build
```

4. **Run tests to verify setup:**

```bash
npm test
```

5. **Open in VS Code:**

```bash
code .
```

## Development Workflow

### Making Changes

1. **Create a branch** for your changes:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

2. **Make your changes** following the coding standards below

3. **Test your changes:**

```bash
npm run build
npm test
```

4. **Test manually in VS Code:**

   - Press `F5` to launch Extension Development Host
   - Open a G-Code file and test your changes
   - Verify formatting, syntax highlighting, etc.

5. **Commit your changes:**

```bash
git add .
git commit -m "feat: add your feature description"
```

6. **Push and create a Pull Request:**

```bash
git push origin feature/your-feature-name
```

## Coding Standards

### General Principles

We follow **SOLID**, **DRY**, and **KISS** principles:

- **SOLID**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **DRY**: Don't Repeat Yourself - reuse code when possible
- **KISS**: Keep It Simple, Stupid - prefer simple solutions

### Code Style

- **TypeScript**: Use strict TypeScript with proper types
- **Formatting**: Use consistent indentation (2 spaces)
- **Naming**:
  - Use descriptive names
  - camelCase for variables and functions
  - PascalCase for classes and types
  - UPPER_CASE for constants
- **Comments**: Add JSDoc comments for public functions and classes
- **Imports**: Organize imports (external first, then internal)

### Example Code Style

```typescript
/**
 * Formats a G-Code document with the given options
 * @param document - The text document to format
 * @param options - Formatting options
 * @returns Formatted G-Code string
 */
export function formatDocument(
  document: TextDocument,
  options: FormatterSettings
): string {
  // Implementation
}
```

### File Organization

- Keep files focused on a single responsibility
- Group related functionality together
- Use index files for clean exports
- Place tests alongside source files (`.test.ts`)

## Testing

### Writing Tests

- Write tests for all new features and bug fixes
- Use descriptive test names that explain what is being tested
- Follow the Arrange-Act-Assert pattern
- Test both success and error cases

### Test Structure

```typescript
import { describe, it, expect } from "@jest/globals";

describe("FeatureName", () => {
  it("should do something specific", () => {
    // Arrange
    const input = "...";

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- gcodeFormatter.test.ts
```

## Pull Request Process

### Before Submitting

1. ✅ All tests pass (`npm test`)
2. ✅ Code builds without errors (`npm run build`)
3. ✅ Type checking passes (`npm run typecheck`)
4. ✅ Code follows style guidelines
5. ✅ Tests added for new features
6. ✅ Documentation updated if needed

### PR Title and Description

Use conventional commit format for PR titles:

- `feat: add new feature`
- `fix: fix bug description`
- `docs: update documentation`
- `refactor: refactor code`
- `test: add tests`
- `chore: update dependencies`

In the PR description, include:

- What changes were made and why
- How to test the changes
- Screenshots (if UI changes)
- Related issues (if any)

### Review Process

- Maintainers will review your PR
- Address feedback promptly
- Keep PRs focused and reasonably sized
- Update your branch if the main branch changes

## Reporting Bugs

### Before Reporting

1. Check if the issue already exists
2. Try to reproduce with the latest version
3. Check VS Code and Node.js versions

### Bug Report Template

When creating an issue, include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Step-by-step instructions
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**:
  - VS Code version
  - Extension version
  - OS version
- **Screenshots**: If applicable
- **G-Code Sample**: If the bug is related to specific G-Code

## Feature Requests

### Suggesting Features

1. Check if the feature was already requested
2. Open an issue with the `enhancement` label
3. Describe:
   - The problem you're trying to solve
   - Proposed solution
   - Use cases
   - Alternatives considered

## Project Structure

Understanding the codebase:

- **`src/client/`**: VS Code extension client (activates extension, starts LSP client)
- **`src/server/`**: Language Server implementation (handles LSP requests)
- **`src/lexer/`**: Tokenizes G-Code into tokens
- **`src/parser/`**: Parses tokens into Abstract Syntax Tree (AST)
- **`src/formatter/`**: Formats AST back to formatted G-Code
- **`src/__tests__/`**: Test fixtures and test files

### Key Files

- `src/client/extension.ts`: Extension entry point
- `src/server/server.ts`: LSP server implementation
- `src/parser/gcodeParser.ts`: Main parser logic
- `src/formatter/gcodeFormatter.ts`: Main formatter logic

## Common Tasks

### Adding a New Formatter Option

1. Add option to `src/formatter/types.ts`
2. Update `defaultFormatterSettings` in `gcodeFormatter.ts`
3. Implement the option in the formatter
4. Add to `package.json` configuration section
5. Update server settings interface
6. Add tests
7. Update README.md

### Adding Syntax Highlighting

1. Edit `syntaxes/gcode.tmLanguage.json`
2. Test in Extension Development Host
3. Update theme if needed in `themes/gcode-theme.json`

### Improving Parser

1. Understand the AST structure in `src/parser/types.ts`
2. Modify `src/parser/gcodeParser.ts`
3. Add test cases in `src/parser/gcodeParser.test.ts`
4. Ensure all existing tests pass

## Getting Help

- Open an issue for bugs or questions
- Check existing issues and discussions
- Review the codebase and tests for examples

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
