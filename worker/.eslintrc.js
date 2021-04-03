module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    "@typescript-eslint/ban-ts-comment": 0,
    "jsx-a11y/accessible-emoji": 0,
    "@typescript-eslint/no-non-null-assertion": 0
  }
};