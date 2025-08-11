const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const importPlugin = require('eslint-plugin-import');

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
      import: importPlugin
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
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
      '@typescript-eslint/no-require-imports': 'error'
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
      // Focus on specific contamination patterns only
    }
  }
);