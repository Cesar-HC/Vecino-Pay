import { expect, test } from '@playwright/test';
import { cerrarSesion, entrarDueno } from '../ayudas/sesion';

// Aislamiento multitienda visto desde el navegador: cada dueño solo ve lo de su tienda.
// La red principal son las pruebas HTTP de `aislamiento.e2e` en la API; aquí se comprueba que la web no filtra nada.
test.describe.configure({ mode: 'serial' });

test('Rosa no ve el selector de tienda; Carlos, con dos tiendas, sí, y el catálogo cambia con la tienda', async ({
  page,
}) => {
  await entrarDueno(page, 'rosa@vecinopay.test');
  // Primero se espera algo del encabezado ya dibujado: sin eso, "ningún selector" sería cierto de inmediato.
  await expect(page.locator('header')).toContainText('Minimarket Doña Rosa');
  await expect(page.locator('header select')).toHaveCount(0);
  await cerrarSesion(page);

  await entrarDueno(page, 'carlos.demo@vecinopay.test');
  const selector = page.locator('header select');
  await expect(selector).toBeVisible();
  await expect(selector.locator('option')).toHaveText([
    'Bodega El Vecino',
    'Pollería El Buen Sabor',
  ]);
  await page.goto('/dueno/productos');
  const catalogo = page.locator('main');
  await expect(catalogo).toContainText('BOD01');
  await expect(catalogo).not.toContainText('P012');
  await expect(catalogo).not.toContainText('P003');
  await selector.selectOption({ label: 'Pollería El Buen Sabor' });
  // Al cambiar de tienda la web vuelve al resumen: se abre el catálogo otra vez.
  await expect(page.locator('main')).toContainText('Resumen del negocio');
  await page.goto('/dueno/productos');
  await expect(page.locator('main')).toContainText('POL01');
  await expect(page.locator('main')).not.toContainText('BOD01');
});

test('Carlos no ve a Luis ni a María, y abrir su ficha o su listado por la URL no muestra sus datos', async ({
  page,
}) => {
  // El id de Luis se obtiene con la sesión de Rosa, por la API.
  await entrarDueno(page, 'rosa@vecinopay.test');
  const tokenRosa = await page.evaluate(() => sessionStorage.getItem('vecinopay.token'));
  const clientes = await page.request.get('/api/clientes', {
    headers: { Authorization: `Bearer ${tokenRosa}` },
  });
  expect(clientes.ok()).toBeTruthy();
  const luis = ((await clientes.json()).items as { id: string; nombres: string }[]).find((c) =>
    c.nombres.includes('Luis'),
  );
  expect(luis).toBeTruthy();
  await cerrarSesion(page);

  await entrarDueno(page, 'carlos.demo@vecinopay.test');
  // En cada pantalla se espera primero su título (la pantalla ya cargó) y su tabla, y recién entonces se
  // comprueba lo que no debe aparecer. Carlos todavía no tiene clientes en Bodega El Vecino.
  await page.goto('/dueno/clientes');
  await expect(page.getByRole('heading', { name: 'Clientes y condiciones' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Luis Quispe');
  await expect(page.locator('main')).not.toContainText('María Huamán');
  await page.goto(`/dueno/clientes/${luis!.id}`);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Luis Quispe');
  await expect(page.locator('body')).not.toContainText('45872316');
  await page.goto('/dueno/listados');
  await expect(page.getByRole('heading', { name: 'Listados de pago' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('EC-202609-00001');
  const tokenCarlos = await page.evaluate(() => sessionStorage.getItem('vecinopay.token'));
  const directo = await page.request.get(`/api/clientes/${luis!.id}`, {
    headers: { Authorization: `Bearer ${tokenCarlos}` },
  });
  expect(directo.status()).toBe(404);
  await cerrarSesion(page);
});

test('Ana, sin clientes, ve el aviso de resumen vacío', async ({ page }) => {
  await entrarDueno(page, 'ana.demo@vecinopay.test');
  await expect(page.locator('main')).toContainText('Aún no tienes clientes');
  await cerrarSesion(page);
});

test('Elena, de una tienda dada de baja, no puede entrar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/^Usuario/).fill('elena.demo@vecinopay.test');
  await page.getByLabel(/^Contraseña/).fill('Tienda#2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('Usuario, contraseña o perfil incorrectos.')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
