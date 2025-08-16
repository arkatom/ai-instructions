const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const importPlugin = require('eslint-plugin-import');
const sonarjs = require('eslint-plugin-sonarjs');

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.js',
      '!src/**/*.js',
      'jest.config.js',
      '*.config.js',
      '.husky/**',
      'backup/**',
      'test-output/**',
      'eslint.config.js'
    ]
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    plugins: {
      import: importPlugin,
      sonarjs: sonarjs
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      // Circular dependency detection
      'import/no-cycle': ['error', {
        maxDepth: Infinity,
        ignoreExternal: true
      }],
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': ['error', {
        noUselessIndex: true
      }],
      
      // Enforce ES6 imports over CommonJS require
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      
      // God Class Prevention Rules
      'max-lines': ['error', {
        max: 300,
        skipBlankLines: true,
        skipComments: true
      }],
      'max-lines-per-function': ['error', {
        max: 50,
        skipBlankLines: true,
        skipComments: true
      }],
      'complexity': ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],
      'max-nested-callbacks': ['error', 3],
      
      // SonarJS code quality rules
      'sonarjs/cognitive-complexity': ['error', 10],
      'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/no-unused-collection': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/prefer-object-literal': 'error',
      'sonarjs/prefer-single-boolean-return': 'error'
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json'
        }
      }
    }
  },
  // Test contamination prevention rules
  {
    files: ['test/**/*.ts', 'test/**/*.js'],
    rules: {
      // Prevent test contamination patterns
      'no-restricted-syntax': [
        'error',
        {
          'selector': 'CallExpression[callee.object.name="process"][callee.property.name="cwd"]',
          'message': 'process.cwd() is forbidden in tests - use isolated test directories instead'
        },
        {
          'selector': 'Literal[value*="../.."]',
          'message': 'Parent directory navigation (../..) is forbidden in tests - use isolated test directories'
        }
      ],
      
      // Relax complexity rules for test files - tests are naturally complex
      'max-nested-callbacks': ['error', 10],  // Tests naturally nest describe/it/expect
      'max-lines-per-function': ['error', 1000], // Test functions can be very long for clarity
      'max-lines': ['error', 1500], // Test files can be very long
      'complexity': ['error', 50], // Test setup can be very complex
      '@typescript-eslint/no-explicit-any': 'warn', // Allow any in tests for mocking
      
      // Relax SonarJS rules for test files
      'sonarjs/no-duplicate-string': ['error', { threshold: 25 }],
      'sonarjs/prefer-single-boolean-return': 'warn',
      'sonarjs/cognitive-complexity': ['error', 50]
    }
  }
);