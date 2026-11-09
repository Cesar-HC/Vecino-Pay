import { expect, test, type Page } from '@playwright/test';
import { cerrarSesion, entrarCliente, entrarDueno } from '../ayudas/sesion';

// RF09: el cliente nunca ve el VAN, el COK ni el precio al contado, ni en pantalla ni en las respuestas de la API.
test.describe.configure({ mode: 'serial' });

const PANTALLAS = ['/m', '/m/menu', '/m/listado', '/m/cuotas', '/m/pagos', '/m/perfil', '/m/ayuda'];
// Cifras que solo conoce la tienda (Tabla 20 y precio contado del juego 2).
const CIFRAS_DE_LA_TIENDA = ['249.80', '269.81', '20.01'];
const CLAVES_PROHIBIDAS = [
  'van',
  'cok',
  'coktea',
  'montocontado',
  'preciocontado',
  'flujo',
  'tir',
  'tirdiaria',
];

const TITULOS: Record<string, RegExp> = {
  '/m': /Mi cuenta/,
  '/m/menu': /Menú principal/,
  '/m/listado': /Mi listado de pago/,
  '/m/cuotas': /Mis (compras en )?cuotas/,
  '/m/pagos': /Mis pagos/,
  '/m/perfil': /Mi perfil y condiciones/,
  '/m/ayuda': /Ayuda y educación financiera/,
};
// Rutas de la API que esas pantallas deben haber consultado: si no se llamaron, no se comprobó nada.
const RUTAS_API = [
  '/api/mi/resumen',
  '/api/mi/listados',
  '/api/mi/cuotas',
  '/api/mi/pagos',
  '/api/mi/perfil',
];
// Un importe de la tienda como cadena ("20.01") o como número (20.01), sin pegarse a otros dígitos.
const IMPORTE_DE_LA_TIENDA = /(?<![\d.])(249\.80?|269\.81|20\.01)(?![\d])/;

function clavesDe(valor: unknown, acumulado: string[] = []): string[] {
  if (Array.isArray(valor)) valor.forEach((v) => clavesDe(v, acumulado));
  else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) {
      acumulado.push(k.toLowerCase());
      clavesDe(v, acumulado);
    }
  }
  return acumulado;
}

async function recorrer(page: Page, dni: string) {
  const respuestas: { ruta: string; cuerpo: unknown }[] = [];
  page.on('response', async (r) => {
    if (!r.url().includes('/api/mi/') || !r.ok()) return;
    respuestas.push({ ruta: new URL(r.url()).pathname, cuerpo: await r.json().catch(() => null) });
  });
  await entrarCliente(page, dni);
  const textos: Record<string, string> = {};
  for (const ruta of PANTALLAS) {
    await page.goto(ruta);
    await expect(page.locator('main')).toBeVisible();
    // La pantalla debe haber cargado de verdad: sin su título, un error o un vacío pasaría la prueba.
    await expect(page.locator('main')).toContainText(TITULOS[ruta]);
    await page.waitForLoadState('networkidle');
    textos[ruta] = await page.locator('body').innerText();
  }
  return { textos, respuestas };
}

for (const [nombre, dni] of [
  ['Luis', '45872316'],
  ['María', '40000002'],
] as const) {
  test(`RF09: ${nombre} no ve VAN, COK ni precio contado en C03 a C09`, async ({ page }) => {
    const { textos, respuestas } = await recorrer(page, dni);
    for (const [ruta, texto] of Object.entries(textos)) {
      expect(texto, `${ruta} no debe nombrar el VAN`).not.toMatch(/\bVAN\b/);
      expect(texto, `${ruta} no debe nombrar el COK`).not.toMatch(/\bCOK\b/);
      expect(texto, `${ruta} no debe hablar del precio al contado`).not.toMatch(/contado/i);
      for (const cifra of CIFRAS_DE_LA_TIENDA)
        expect(texto, `${ruta} muestra ${cifra}`).not.toContain(cifra);
    }
    // Las respuestas de la API tampoco traen esos campos.
    const rutas = respuestas.map((r) => r.ruta);
    for (const esperada of RUTAS_API)
      expect(rutas, `no se consultó ${esperada}`).toContain(esperada);
    for (const { ruta, cuerpo } of respuestas) {
      const claves = clavesDe(cuerpo);
      for (const prohibida of CLAVES_PROHIBIDAS)
        expect(claves, `${ruta} trae "${prohibida}"`).not.toContain(prohibida);
      const json = JSON.stringify(cuerpo);
      expect(json, `${ruta} trae un importe de la tienda`).not.toMatch(IMPORTE_DE_LA_TIENDA);
    }
  });
}

test('espejo positivo: Rosa sí ve el VAN y el precio contado en D05', async ({ page }) => {
  // Evita un falso verde: si D05 dejara de mostrarlos, la prueba anterior no probaría nada.
  await entrarDueno(page, 'rosa@vecinopay.test');
  await page.goto('/dueno/cronogramas');
  await page.getByText('T-000284').first().click();
  await expect(page.locator('main')).toContainText(/VAN\s*S\/ 20\.01/);
  await expect(page.locator('main')).toContainText('S/ 249.80');
  await expect(page.locator('main')).toContainText('S/ 269.81');
});

test('Luis no entra a las pantallas del dueño ni a la API de la tienda', async ({ page }) => {
  await entrarCliente(page, '45872316');
  await page.goto('/dueno/clientes');
  await expect(page).not.toHaveURL(/\/dueno\/clientes/);
  await page.goto('/admin');
  await expect(page).not.toHaveURL(/\/admin$/);
  const token = await page.evaluate(() => sessionStorage.getItem('vecinopay.token'));
  expect(token).toBeTruthy();
  for (const ruta of ['/api/clientes', '/api/plataforma/resumen']) {
    const r = await page.request.get(ruta, { headers: { Authorization: `Bearer ${token}` } });
    expect(r.status(), ruta).toBe(403);
  }
  await cerrarSesion(page);
});
