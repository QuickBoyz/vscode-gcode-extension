import { glob } from 'glob';
import Mocha from 'mocha';
import * as path from 'path';

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
      ui: 'tdd',
      color: true,
    }),
    testsRoot = path.resolve(__dirname, '..');

  return new Promise((c, e) => {
    glob('**/*.test.ts', { cwd: testsRoot })
      .then((files) => {
        // Add files to the test suite
        files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // Run the mocha test
          mocha.run((failures: number) => {
            if (failures > 0) {
              e(new Error(`${failures} tests failed.`));
            } else {
              c();
            }
          });
        } catch (err: unknown) {
          e(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .catch((err: unknown) => {
        return e(err instanceof Error ? err : new Error(String(err)));
      });
  });
}
