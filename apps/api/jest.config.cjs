/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  setupFiles: ['<rootDir>/test/load-env.ts'],
  testPathIgnorePatterns: ['\\.e2e-spec\\.ts$'],
  moduleNameMapper: {
    '^@personal-assistant/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
};
