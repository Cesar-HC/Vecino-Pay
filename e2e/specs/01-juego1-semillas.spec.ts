import { expect, test } from '@playwright/test';
import { cerrarSesion, entrarAdmin, entrarDueno } from '../ayudas/sesion';

// Juego 1 (Tablas 16 y 17 del informe) sobre las semillas, con el reloj en 22/09/2026 12:00.
test.describe.configure({ mode: 'serial' });

test.describe('Juego 1: Luis Quispe, compras a fin de mes', () => {
  test('A01: una clave mala se explica y la correcta entra', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/^Usuario/).fill('rosa@vecinopay.test');
    await page.getByLabel(/^Contraseña/).fill('mala-clave');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByText('Usuario, contraseña o perfil incorrectos.')).toBeVisible();
    await entrarDueno(page, 'rosa@vecinopay.test');
  });

  test('D06: el listado EC-202609-00001 reproduce la Tabla 16 al céntimo', async ({ page }) => {
    await entrarDueno(page, 'rosa@vecinopay.test');
    await page.goto('/dueno/listados');
    await page.getByText('EC-202609-00001').first().click();
    const cuerpo = page.locator('main');
    await expect(cuerpo).toContainText('Listado EC-202609-00001');
    // Una fila por compra, celda por celda (columnas: ticket, registro, fecha operativa, detalle,
    // días, capital, interés, total). Las compras hechas después de las 17:00 llevan asterisco
    // y cuentan desde el día siguiente (T-000245 y T-000278).
    const filas: [string, string, string, string, string, string, string, string][] = [
      ['T-000231', '22/08/2026 09:15', '22/08/2026', '35', '44.20', '1.63', '45.83', ''],
      ['T-000245', '29/08/2026 18:40', '30/08/2026', '27', '32.80', '0.93', '33.73', ' *'],
      ['T-000262', '05/09/2026 11:05', '05/09/2026', '21', '63.82', '1.40', '65.22', ''],
      ['T-000278', '12/09/2026 19:30', '13/09/2026', '13', '30.50', '0.41', '30.91', ' *'],
      ['T-000290', '18/09/2026 08:50', '18/09/2026', '8', '52.30', '0.43', '52.73', ''],
    ];
    for (const [ticket, registro, operativa, dias, capital, interes, total, marca] of filas) {
      const celdas = page.getByRole('row').filter({ hasText: ticket }).locator('td');
      await expect(celdas).toHaveCount(8);
      await expect(celdas.nth(0)).toHaveText(`${ticket}${marca}`);
      await expect(celdas.nth(1)).toHaveText(registro);
      await expect(celdas.nth(2)).toHaveText(operativa);
      await expect(celdas.nth(4)).toHaveText(dias);
      await expect(celdas.nth(5)).toHaveText(`S/ ${capital}`);
      await expect(celdas.nth(6)).toHaveText(`S/ ${interes}`);
      await expect(celdas.nth(7)).toHaveText(`S/ ${total}`);
    }
    // Pie del listado: capital, interés y total.
    await expect(cuerpo).toContainText(/Total a pagar\s*S\/ 223\.62\s*S\/ 4\.80\s*S\/ 228\.42/);
    // La compra del 20/09 a las 17:45 queda fuera del listado y pasa al ciclo siguiente.
    await expect(cuerpo).toContainText(
      'La compra T-000301 del 20/09/2026 17:45 por S/ 21.30 no está en este listado',
    );
    await expect(cuerpo).toContainText('se paga el 26/10/2026');
  });

  test('D06: valor de hoy al 16/09/2026 = descuento S/ 2.35 y valor neto S/ 226.07', async ({
    page,
  }) => {
    await entrarDueno(page, 'rosa@vecinopay.test');
    await page.goto('/dueno/listados');
    await page.getByText('EC-202609-00001').first().click();
    await page.locator('input[type=date]').fill('2026-09-16');
    const cuerpo = page.locator('main');
    await expect(cuerpo).toContainText(/Días hasta la fecha de pago\s*10(?!\d)/);
    await expect(cuerpo).toContainText('1.0268129 %');
    await expect(cuerpo).toContainText(/Descuento\s*S\/ 2\.35/);
    await expect(cuerpo).toContainText(/Valor neto\s*S\/ 226\.07/);
  });

  test('D04: una compra de S/ 999.00 se rechaza y no registra nada', async ({ page }) => {
    await entrarDueno(page, 'rosa@vecinopay.test');
    await page.goto('/dueno/compras/nueva');
    await page.getByLabel('Cliente').selectOption({ label: 'Luis Quispe' });
    await page.getByLabel('Producto').selectOption({ label: 'P003 · Aceite 1 L' });
    await page.getByLabel('Cantidad').fill('99.900');
    await page.getByRole('button', { name: 'Confirmar compra' }).click();
    // Con las semillas, T-000301 ya está cargada: el disponible es 255.08 (la corrida desde cero da 276.38).
    await expect(page.getByRole('alert')).toContainText('255.08');
    await page.goto('/dueno/clientes');
    await expect(page.locator('main')).toContainText('S/ 255.08');
  });

  test('A05: el intento rechazado queda en la auditoría sin mostrar importes', async ({ page }) => {
    await entrarAdmin(page);
    await page.goto('/admin/auditoria');
    await page.getByLabel(/^Acción/).selectOption('RECHAZO');
    // Las semillas ya traen un RECHAZO de compra del 19/09: el nuevo es el de hoy (22/09/2026 12:00),
    // de la tabla `compra`. Los rechazos de inicio de sesión son de la tabla `usuario`.
    const nuevo = page
      .getByRole('row')
      .filter({ hasText: 'RECHAZO' })
      .filter({ hasText: '22/09/2026 12:00:00' })
      .filter({ hasText: 'compra' });
    await expect(nuevo).toHaveCount(1);
    await expect(nuevo).toContainText('Minimarket Doña Rosa');
    await expect(nuevo).toContainText('rosa@vecinopay.test');
    // El importe de la compra no se muestra al administrador, tampoco el de la semilla.
    await expect(page.locator('main')).not.toContainText('999.00');
    await expect(page.locator('main')).not.toContainText('255.08');
    await cerrarSesion(page);
  });
});
