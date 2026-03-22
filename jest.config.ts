import type { Config } from 'jest';

const config: Config = {
  clearMocks: true,
  coverageProvider: 'v8',
  globalSetup: './jest.globalSetup.js',
  moduleFileExtensions: ['js', 'ts', 'json'],
  testMatch: ['**/test/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  verbose: true,
};

export default config;
