import { expect, type Page } from '@playwright/test';

async function ingresar(page: Page, ruta: string, usuario: string, clave: string, perfil?: string) {
  await page.goto(ruta);
  await page.getByLabel(/^(Usuario|DNI)/).fill(usuario);
  await page.getByLabel(/^Contraseña/).fill(clave);
  if (perfil) await page.getByLabel(/^Perfil/).selectOption({ label: perfil });
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

export async function entrarDueno(page: Page, usuario: string, clave = 'Tienda#2026') {
  await ingresar(page, '/login', usuario, clave);
  await expect(page).toHaveURL(/\/dueno/);
}

export async function entrarAdmin(page: Page) {
  await ingresar(page, '/login', 'admin@vecinopay.test', 'Admin#2026', 'Administrador del sistema');
  await expect(page).toHaveURL(/\/admin/);
}

export async function entrarCliente(page: Page, dni: string, clave = 'Vecino#2026') {
  await ingresar(page, '/m/login', dni, clave);
  await expect(page).toHaveURL(/\/m(\/|$)/);
}

/** Cierra la sesión sin depender de la pantalla: vacía el almacenamiento del navegador. */
export async function cerrarSesion(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
}
