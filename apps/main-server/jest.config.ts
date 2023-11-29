import type { Config } from 'jest';

const config: Config = {
  displayName: 'main-server',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/main-server',
  setupFilesAfterEnv: ['./jest.setup.ts'],
};

export default config;
