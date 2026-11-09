import { expect, test } from '@playwright/test';
import { cerrarSesion, entrarCliente } from '../ayudas/sesion';

// Landing en «/» e ingreso único. No hay registro abierto: el cliente solo activa su cuenta.
test('la landing lleva a ingresar y a activar la cuenta, sin registro', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('cuaderno del fiado');
  await expect(page.getByRole('link', { name: /registr/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /registr/i })).toHaveCount(0);

  await page.getByRole('link', { name: 'Activa tu cuenta' }).click();
  await expect(page).toHaveURL(/\/m\/activar$/);

  await page.goto('/');
  await page.getByRole('link', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
});

test('un cliente entra desde la landing y un dueño desde la pestaña Soy dueño', async ({
  page,
}) => {
  await page.goto('/ingresar');
  await page.getByLabel(/^DNI/).fill('45872316');
  await page.getByLabel(/^Contraseña/).fill('Vecino#2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/m\/?$/);

  await cerrarSesion(page);
  await page.goto('/ingresar');
  await page.getByRole('tab', { name: 'Soy dueño' }).click();
  await page.getByLabel(/^Usuario/).fill('rosa@vecinopay.test');
  await page.getByLabel(/^Contraseña/).fill('Tienda#2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/dueno/);
});

test('/login y /m/login siguen cargando y con sesión «/» va al inicio', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel(/^Perfil/)).toBeVisible();
  await page.goto('/m/login');
  await expect(page.getByLabel(/^DNI/)).toBeVisible();

  await entrarCliente(page, '45872316');
  await page.goto('/');
  await expect(page).toHaveURL(/\/m\/?$/);
});
