/// Start of Selection
import onlyWarn from 'eslint-plugin-only-warn'
import unusedImports from 'eslint-plugin-unused-imports'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    files: ['app/**/*.{js,jsx,ts,tsx}'],
    extends: [
      tseslint.configs.recommended,
    ],
    plugins: {
      '@stylistic': stylistic,
      'unused-imports': unusedImports,
      'only-warn': onlyWarn,
    },
    rules: {
      quotes: ['off'],
      'jsx-quotes': ['warn', 'prefer-double'],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'multiline-ternary': ['off'],
      curly: ['warn', 'multi-line'],
      'operator-linebreak': [
        'warn',
        'after',
        {
          overrides: {
            '?': 'before',
            ':': 'before',
            '&&': 'before',
            '||': 'before',
          },
        },
      ],
      'arrow-parens': ['warn', 'as-needed'],
      'operator-linebreak': 'off',
      'no-explicit-any': ['off'],
      '@typescript-eslint/no-explicit-any': ['off'],
      'ban-ts-comment': ['off'],
    },
  },
)
