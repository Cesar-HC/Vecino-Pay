import { expect, test, type Page } from '@playwright/test';
import { fijarReloj } from '../entorno';
import { entrarCliente, entrarDueno } from '../ayudas/sesion';

// Juego 1, Tabla 17: pago puntual, con 1 día y con 5 días de mora, pago parcial, imputación y disponible.
// El listado se paga una sola vez: este spec va después de 01 y 02 y antes de los que dependen del estado final.
test.describe.configure({ mode: 'serial' });

async function abrirPagoDeLuis(page: Page) {
  await entrarDueno(page, 'rosa@vecinopay.test');
  await page.goto('/dueno/listados');
  await page.getByText('EC-202609-00001').first().click();
  await page.getByRole('link', { name: 'Registrar pago' }).click();
  await expect(
    page.getByRole('heading', { name: /Registrar pago · EC-202609-00001/ }),
  ).toBeVisible();
}

test.describe('Juego 1: pagos de Luis Quispe', () => {
  test('26/09 12:00, pago puntual: sin mora, total S/ 228.42', async ({ page }) => {
    await fijarReloj('2026-09-26T12:00:00-05:00');
    await abrirPagoDeLuis(page);
    const cuerpo = page.locator('main');
    await expect(cuerpo).toContainText(/Días de mora\s*\??\s*0/);
    await expect(cuerpo).toContainText(/Mora\s*\??\s*S\/ 0\.00/);
    await expect(cuerpo).toContainText(/Total a pagar\s*\??\s*S\/ 228\.42/);
  });

  test('26/09 17:30, después de la hora de corte: cuenta como 27/09, mora S/ 0.06 y total S/ 228.48', async ({
    page,
  }) => {
    await fijarReloj('2026-09-26T17:30:00-05:00');
    await abrirPagoDeLuis(page);
    const cuerpo = page.locator('main');
    await expect(cuerpo).toContainText(/Días de mora\s*\??\s*1(?!\d)/);
    await expect(cuerpo).toContainText(/Mora\s*\??\s*S\/ 0\.06/);
    await expect(cuerpo).toContainText(/Total a pagar\s*\??\s*S\/ 228\.48/);
  });

  test('01/10 12:00, 5 días de atraso: mora S/ 0.30, 200.00 se rechaza y 228.72 se acepta con su imputación', async ({
    page,
  }) => {
    await fijarReloj('2026-10-01T12:00:00-05:00');
    await abrirPagoDeLuis(page);
    const cuerpo = page.locator('main');
    await expect(cuerpo).toContainText(/Días de mora\s*\??\s*5(?!\d)/);
    await expect(cuerpo).toContainText(/Mora\s*\??\s*S\/ 0\.30/);
    await expect(cuerpo).toContainText(/Total a pagar\s*\??\s*S\/ 228\.72/);

    // Pago parcial: rechazado con el importe correcto.
    await page.getByLabel('Monto pagado').fill('200.00');
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(cuerpo).toContainText('Monto correcto: S/ 228.72');

    // Pago exacto: aceptado, con prelación mora, interés y capital.
    await page.getByLabel('Monto pagado').fill('228.72');
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.getByRole('heading', { name: 'Pago registrado' })).toBeVisible();
    await expect(cuerpo).toContainText('Se registró el pago de S/ 228.72');
    await expect(cuerpo).toContainText(/Días de mora\s*5/);
    await expect(cuerpo).toContainText(/Imputado a mora\s*S\/ 0\.30/);
    await expect(cuerpo).toContainText(/Imputado a interés\s*S\/ 4\.80/);
    await expect(cuerpo).toContainText(/Imputado a capital\s*S\/ 223\.62/);
    await expect(cuerpo).toContainText(/Disponible del cliente\s*S\/ 478\.70/);
  });

  test('el listado ya pagado no se puede pagar otra vez', async ({ page }) => {
    await entrarDueno(page, 'rosa@vecinopay.test');
    await page.goto('/dueno/listados');
    await page.getByText('EC-202609-00001').first().click();
    await expect(page.locator('main')).toContainText('PAGADO');
    await page.goto(page.url() + '/pago');
    await expect(page.getByText('Este listado ya está pagado.')).toBeVisible();
  });

  test('C07 y C03 de Luis en el celular: imputación 0.30, 4.80 y 223.62 y disponible S/ 478.70', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await entrarCliente(page, '45872316');
    await page.goto('/m/pagos');
    const cuerpo = page.locator('main');
    await expect(cuerpo).toContainText('S/ 228.72');
    await expect(cuerpo).toContainText('S/ 0.30');
    await expect(cuerpo).toContainText('S/ 4.80');
    await expect(cuerpo).toContainText('S/ 223.62');
    await expect(cuerpo).toContainText('S/ 478.70');
    await page.goto('/m');
    await expect(page.locator('main')).toContainText('S/ 478.70');
  });
});
