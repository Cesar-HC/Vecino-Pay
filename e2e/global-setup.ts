import { compose, esperarApi } from './entorno';

/** BD recién sembrada y reloj en 22/09/2026 12:00. Solo toca el proyecto `vecinopay-e2e`. */
export default async function globalSetup(): Promise<void> {
  compose(['down', '-v']);
  compose(['up', '-d', '--build']);
  await esperarApi();
}
