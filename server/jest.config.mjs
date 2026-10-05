import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { pathsToModuleNameMapper } from 'ts-jest';

dotenv.config({ path: fileURLToPath(new URL('./.env.local', import.meta.url)) });
process.env.NODE_ENV = 'development';

const { compilerOptions } = JSON.parse(
  readFileSync(new URL('./tsconfig.json', import.meta.url), 'utf8'),
);

export default {
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  testPathIgnorePatterns: ['/lib/', '/node_modules/', '/img/', '/dist/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  modulePaths: ['src'],
  moduleDirectories: ['node_modules'],
};