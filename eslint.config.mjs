import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const globalesNode = {
  process: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  module: 'writable',
  require: 'readonly',
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: { globals: globalesNode },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // La hora de una operación sale siempre del reloj inyectable, y la BD solo se toca con el ámbito de tienda.
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/reloj/**', 'apps/api/src/bd/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Usa el reloj inyectable (RELOJ), no new Date().',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Usa el reloj inyectable (RELOJ), no Date.now().',
        },
        {
          selector: "MemberExpression[property.name=/^\\$(queryRaw|executeRaw)/]",
          message: 'Las consultas crudas solo van en src/bd/.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/bd/prisma.service', '**/prisma.service'],
              message: 'Usa BdService; el cliente Prisma solo se importa dentro de src/bd/.',
            },
          ],
        },
      ],
    },
  },
);
