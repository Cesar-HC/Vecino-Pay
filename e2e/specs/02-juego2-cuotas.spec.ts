import { expect, test } from '@playwright/test';
import { fijarReloj, RELOJ_INICIAL } from '../entorno';
import { entrarCliente, entrarDueno } from '../ayudas/sesion';

// Juego 2 (Tablas 18 a 20): María Huamán compra una olla y un hervidor en 3 cuotas con TNA 42 % mensual.
test.describe.configure({ mode: 'serial' });

test.describe('Juego 2: María Huamán, compra en cuotas', () => {
  test('D04 con reloj 15/09 10:35: la simulación reproduce las Tablas 18 a 20 sin confirmar', async ({
    page,
  }) => {
    await fijarReloj('2026-09-15T10:35:00-05:00');
    await entrarDueno(page, 'rosa@vecinopay.test');
    await page.goto('/dueno/compras/nueva');
    await page.getByLabel('Cliente').selectOption({ label: 'María Huamán' });
    await page.getByLabel('Modalidad').selectOption({ label: 'En cuotas' });
    await page.getByLabel('Producto').first().selectOption({ label: 'P012 · Olla arrocera' });
    await page.getByLabel('Cantidad').first().fill('1');
    await page.getByRole('button', { name: 'Agregar producto' }).click();
    await page.getByLabel('Producto').nth(1).selectOption({ label: 'P013 · Hervidor' });
    await page.getByLabel('Cantidad').nth(1).fill('1');
    const sim = page.locator('main');
    await expect(sim).toContainText(/Total a precio de lista\s*\??\s*S\/ 257\.80/);
    await expect(sim).toContainText(/Total al contado\s*\??\s*S\/ 249\.80/);
    await expect(sim).toContainText(/Fecha de pago\s*\??\s*26\/09\/2026/);
    await expect(sim).toContainText(/Días de gracia \(g\)\s*\??\s*11/);
    await expect(sim).toContainText(/Capital con gracia \(P'\)\s*\??\s*S\/ 261\.07/);
    await expect(sim).toContainText(/Interés de gracia\s*\??\s*S\/ 3\.27/);
    await expect(sim).toContainText(/Cuota \(R\)\s*\??\s*S\/ 93\.25/);
    await expect(sim).toContainText(/Última cuota\s*\??\s*S\/ 93\.26/);
    await expect(sim).toContainText(/TCEA\s*\??\s*51\.09 %/);
    await expect(sim).toContainText('TIR diaria = 0.0011469966');
    await expect(sim).toContainText(/VAN\s*\??\s*S\/ 20\.01/);
    // Valores actuales de la tabla del simulador: 91.33 + 89.91 + 88.56 = 269.81.
    for (const va of ['S/ 91.33', 'S/ 89.91', 'S/ 88.56', 'S/ 269.81'])
      await expect(sim).toContainText(va);
    // No se confirma: T-000284 ya existe en las semillas y duplicaría el juego.
  });

  test('D05: el cronograma de T-000284 reproduce la Tabla 19 y el flujo de caja la Tabla 20', async ({
    page,
  }) => {
    await fijarReloj(RELOJ_INICIAL);
    await entrarDueno(page, 'rosa@vecinopay.test');
    await page.goto('/dueno/cronogramas');
    await page.getByText('T-000284').first().click();
    const cuerpo = page.locator('main');
    await expect(cuerpo).toContainText('Cronograma T-000284');
    const filas: [string, string, string, string, string, string][] = [
      ['26/10/2026', '261.07', '9.14', '84.11', '93.25', '176.96'],
      ['26/11/2026', '176.96', '6.40', '86.85', '93.25', '90.11'],
      ['26/12/2026', '90.11', '3.15', '90.11', '93.26', '0.00'],
    ];
    for (const [vence, inicial, interes, amort, cuota, final] of filas) {
      const fila = page
        .getByRole('row')
        .filter({ hasText: `S/ ${inicial}` })
        .filter({ hasText: `S/ ${final}` });
      await expect(fila.first()).toContainText(`S/ ${interes}`);
      await expect(fila.first()).toContainText(`S/ ${amort}`);
      await expect(fila.first()).toContainText(`S/ ${cuota}`);
      await expect(fila.first()).toContainText(vence);
    }
    await expect(cuerpo).toContainText(/Totales\s*S\/ 18\.69\s*S\/ 261\.07\s*S\/ 279\.76/);
    await expect(cuerpo).toContainText(/Intereses totales\s*\??\s*S\/ 21\.96/);
    await expect(cuerpo).toContainText(/TCEA\s*\??\s*51\.09 %/);
    await expect(cuerpo).toContainText(/Suma de los valores actuales de las cuotas\s*S\/ 269\.81/);
    await expect(cuerpo).toContainText(/VAN\s*S\/ 20\.01/);
  });

  test('C02: María activa su cuenta con el código MDR-7K2Q y entra a su inicio', async ({
    page,
  }) => {
    await page.goto('/m/activar');
    await page.getByLabel('DNI').fill('40000002');
    await page.getByLabel('Código de activación').fill('MDR-7K2Q');
    await page.getByLabel('Teléfono celular').fill('999000111');
    await page.getByLabel('Nueva contraseña').fill('Vecino#2026');
    await page.getByLabel('Confirma tu contraseña').fill('Vecino#2026');
    await page.getByLabel(/^Acepto el tratamiento/).check();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/m$/);
    await expect(page.getByText('Hola, María')).toBeVisible();
  });

  test('C06 y C03 de María: cuotas 93.25, 93.25 y 93.26, TCEA 51.09 % y 11 días de gracia', async ({
    page,
  }) => {
    await entrarCliente(page, '40000002');
    await expect(page.locator('main')).toContainText('Mi cuenta');
    await page.goto('/m/cuotas');
    const cuerpo = page.locator('main');
    await expect(cuerpo).toContainText('Compra T-000284 · 3 cuotas');
    await expect(cuerpo).toContainText('TCEA: 51.09 %');
    await expect(cuerpo).toContainText('S/ 93.26');
    await expect(page.getByText('S/ 93.25')).toHaveCount(3); // cuota mensual + cuotas 1 y 2
    await expect(cuerpo).toContainText('¿Por qué 11 días de gracia?');
    await expect(cuerpo).toContainText('S/ 3.27');
    await expect(cuerpo).toContainText('S/ 261.07');
    await expect(cuerpo).toContainText('26/10/2026');
    // Sin pagos todavía.
    await page.goto('/m/pagos');
    await expect(page.locator('main')).toContainText('Aún no registras pagos');
  });
});
