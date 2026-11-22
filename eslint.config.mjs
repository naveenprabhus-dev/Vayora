import { baseEslintConfig } from './packages/config/eslint/base.mjs';
import { reactAccessibilityConfig } from './packages/config/eslint/react.mjs';
import { firestoreRulesEslintConfig } from './packages/config/eslint/firestore.mjs';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.ts',
      '**/*.tsx',
    ],
  },
  ...baseEslintConfig,
  ...reactAccessibilityConfig,
  ...firestoreRulesEslintConfig,
];
