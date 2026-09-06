// Flat config (ESLint 9+/10 dropped the legacy .eslintrc format). This is a
// direct port of the old .eslintrc.json - same plugins, same rule overrides,
// same ignored paths - not a stricter or looser ruleset.
const js = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '**/*.js'],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: null,
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      // This codebase uses `condition && call()` throughout as a plain
      // conditional-invocation idiom (optional callback props, etc.) -
      // @typescript-eslint v8's recommended no-unused-expressions doesn't
      // allow that by default, flagging ~20 pre-existing, intentional call
      // sites. allowShortCircuit accepts the existing idiom instead of
      // rewriting every one of them to an if-statement.
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      // Neither eslint:recommended's no-redeclare nor @typescript-eslint's
      // version (without type-aware `project` parsing, which this config
      // deliberately doesn't enable) understands TypeScript's separate type/
      // value namespaces - both misflag the `interface Foo {}` + `const Foo`
      // pattern this codebase uses (e.g. GeoWorkspaceArea.tsx naming a
      // component the same as its type) as a duplicate declaration, and an
      // ambient `declare const X` that intentionally names a DOM global
      // (AIVoiceAssistant.tsx's SpeechRecognition) the same way.
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'off',
      // preserve-caught-error wants `throw new Error(msg, { cause })` - the
      // 2-arg Error constructor is an ES2022 addition, but tsconfig.json
      // targets ES2020/lib ES2020 project-wide, so TS doesn't know that
      // overload exists (a real TS2554 error, not a lint false positive).
      // Bumping the whole project's target/lib is a separate, bigger call
      // than this lint migration - off for now rather than force that here.
      'preserve-caught-error': 'off',
    },
  },
  prettierConfig,
];
