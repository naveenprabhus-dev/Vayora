import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';

export const reactAccessibilityConfig = [
  {
    files: ['apps/web/**/*.{js,jsx,mjs}', 'src/**/*.{js,jsx,mjs}'],
    plugins: {
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
];

export default reactAccessibilityConfig;
