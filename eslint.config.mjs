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
    // La web no calcula con montos: la hora y las cifras salen de la API.
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/pruebas/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'parseFloat', message: 'Los montos son texto: no se convierten a número.' },
        { name: 'parseInt', message: 'Para enteros de lista usa aEntero de lib/entrada.ts.' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "CallExpression[callee.name='Number']", message: 'Number() solo va en lib/grafico.ts.' },
        { selector: "MemberExpression[object.name='Number']", message: 'Los montos son texto: no se convierten a número.' },
        { selector: "NewExpression[callee.name='Number']", message: 'Los montos son texto: no se convierten a número.' },
        { selector: "CallExpression > Identifier.arguments[name='Number']", message: 'Los montos son texto: no se convierten a número.' },
        { selector: "MemberExpression[object.name='globalThis'][property.name=/^parse/]", message: 'Los montos son texto: no se convierten a número.' },
        { selector: "MemberExpression[object.name='Math'][property.name=/^(round|floor|trunc|abs|pow)$/]", message: 'La web no calcula con montos.' },
        { selector: "MemberExpression[object.name='window'][property.name=/^parse/]", message: 'Los montos son texto: no se convierten a número.' },
        { selector: "UnaryExpression[operator='+']", message: 'Los montos son texto: no se convierten a número.' },
        { selector: "NewExpression[callee.name='Date'][arguments.length=0]", message: 'La fecha sale de la API, no del navegador.' },
        { selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']", message: 'La fecha sale de la API, no del navegador.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@vecinopay/finance', message: 'El cálculo solo existe en la API.' }],
          patterns: [{ group: ['decimal.js'], message: 'decimal.js solo en lib/formato.ts y lib/entrada.ts.' }],
        },
      ],
    },
  },
  { files: ['apps/web/src/lib/grafico.ts'], rules: { 'no-restricted-syntax': 'off' } },
  { files: ['apps/web/src/lib/formato.ts', 'apps/web/src/lib/entrada.ts'], rules: { 'no-restricted-imports': 'off', 'no-restricted-globals': 'off' } },
  {
    // Los servicios de operación no pueden salir del ámbito de su tienda.
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/{bd,reloj,auth,auditoria,plataforma,cortes}/**'],
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
