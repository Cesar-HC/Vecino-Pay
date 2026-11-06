const comun = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@vecinopay/finance$': '<rootDir>/../../packages/finance/src/index.ts' },
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }] },
};

module.exports = {
  projects: [
    { ...comun, displayName: 'unit', roots: ['<rootDir>/test/unit'] },
    {
      ...comun,
      displayName: 'integracion',
      roots: ['<rootDir>/test/integracion'],
      setupFiles: ['<rootDir>/test/apoyo/entorno-integracion.ts'],
    },
  ],
};
