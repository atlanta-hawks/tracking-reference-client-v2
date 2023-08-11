module.exports = {
  extends: ['airbnb-typescript/base', 'plugin:import/recommended'],
  parserOptions: {
    project: './tsconfig.json'
  },
  rules: {
    'import/namespace': 'warn',
    'import/named': 'warn',
    '@typescript-eslint/comma-dangle': 'warn',
    '@typescript-eslint/no-shadow': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-use-before-define': 'warn'
  }
};
