import { expect, test } from '@playwright/test';
import { entrarDueno } from '../ayudas/sesion';

// Prueba de humo: el entorno aparte levanta, la web llega a la API y las semillas están cargadas.
test('Rosa entra y D01 muestra las cifras del juego 1 al 22/09/2026', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText(/reloj fijo en 22\/09\/2026 12:00:00/)).toBeVisible();
  await entrarDueno(page, 'rosa@vecinopay.test');
  const cuerpo = page.locator('body');
  for (const cifra of ['S/ 502.72', 'S/ 228.42', 'S/ 4.80', 'S/ 0.00', 'S/ 20.01']) {
    await expect(cuerpo).toContainText(cifra);
  }
});
