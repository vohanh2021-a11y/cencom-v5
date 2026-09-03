export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  globalSetup: '<rootDir>/globalSetup.js',
  testTimeout: 30000,
  verbose: true,
  collectCoverageFrom: [
    '../../apps/web/lib/**/*.ts',
    '../../packages/core/src/**/*.ts',
  ],
  coverageDirectory: 'coverage/conformance',
  moduleNameMapper: {
    '^@cencom/core$': '<rootDir>/../../packages/core/src/index.ts',
    '^@cencom/db$': '<rootDir>/../../packages/db/src/index.ts',
    '^@cencom/contract$': '<rootDir>/../../packages/contract/src/index.ts',
    '^supertest$': '<rootDir>/../../node_modules/supertest/index.js',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        lib: ['ES2022'],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
      },
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@cencom|@electric-sql|supertest)/)',
  ],
  extensionsToTreatAsEsm: ['.ts'],
};