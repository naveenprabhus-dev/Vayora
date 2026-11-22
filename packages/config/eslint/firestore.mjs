import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export const firestoreRulesEslintConfig = [
  {
    ...firebaseRulesPlugin.configs['flat/recommended'],
    files: ['**/*.rules'],
  },
];

export default firestoreRulesEslintConfig;
