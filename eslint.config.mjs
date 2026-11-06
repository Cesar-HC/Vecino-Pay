import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const globalesNode = {
  process: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  module: 'writable',
  require: 'readonly',
};

// La hora de una operación sale siempre del reloj inyectable, y las consultas crudas solo van en src/bd/.
const RESTRICCIONES = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Usa el reloj inyectable (RELOJ), no new Date().',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Usa el reloj inyectable (RELOJ), no Date.now().',
  },
  {
    selector: 'MemberExpression[property.name=/^\\$(queryRaw|executeRaw)/]',
    message: 'Las consultas crudas solo van en src/bd/.',
  },
];

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
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/reloj/**', 'apps/api/src/bd/**'],
    rules: {
      'no-restricted-syntax': ['error', ...RESTRICCIONES],
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
  {
    // Los servicios de operación no pueden salir del ámbito de su tienda.
    files: ['apps/api/src/{productos,clientes,compras,listados,negocio,mi}/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...RESTRICCIONES,
        {
          selector: 'MemberExpression[property.name=/^(global|transaccionGlobal|auditarEn)$/]',
          message: 'Usa enTienda o transaccionEnTienda: esta capa no sale del ámbito de la tienda.',
        },
      ],
    },
  },
);
