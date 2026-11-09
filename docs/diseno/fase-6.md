# Diseño de la fase 6: pruebas E2E de navegador y guía de la demo

Fuentes, en orden: `docs/informe_v8.txt` (6.4, Tablas 16 a 20), `docs/prompt_desarrollo.md` (sección 8, fase 6), `CLAUDE.md`.
Cifras tomadas de 6.4 y de `db/init/02_semillas.sql`. No se inventa ninguna.

## 1. Resumen
1. Una carpeta `e2e/` con `@playwright/test` (Chromium, 1 worker, specs en serie) corre contra un proyecto Docker aparte: `docker compose -p vecinopay-e2e`, puertos 18080/13000/11433, volumen propio y BD recién sembrada. Nunca toca el proyecto `vecinopay`.
2. El reloj (`RELOJ_FIJO`) cambia entre pasos con `docker compose -p vecinopay-e2e up -d api` y un `waitForHealth`. Cada spec fija su reloj en `beforeAll`.
3. Los juegos 1 y 2 se recorren sobre las semillas (estado 22/09/2026) por las pantallas A01, D01, D04 a D07 y C01 a C07. La corrida "desde cero" (276.38) ya la cubre `juegos.e2e.spec.ts` por HTTP.
4. RF09 y aislamiento multitienda se validan en el navegador con texto visible y con las respuestas de red.
5. `docs/guia_demo.md` da el guion de unos 15 minutos con relojes, usuarios y plan B.

## 2. Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `e2e/package.json` no se crea; se usa el workspace raíz | Evita un segundo `npm install`. Se añade `@playwright/test` a `devDependencies` de la raíz. |
| `playwright.config.ts` (raíz) | `testDir: e2e/specs`, `workers: 1`, `fullyParallel: false`, `retries: 0`, `timeout: 60000`, `baseURL: http://localhost:${E2E_WEB_PORT}`, `globalSetup`, `globalTeardown`, `locale: 'es-PE'`, `timezoneId: 'America/Lima'`, `trace: 'retain-on-failure'`, reporte `list` y `html`. |
| `e2e/entorno.ts` | Constantes: proyecto `vecinopay-e2e`, `DB_PORT=11433`, `API_PORT=13000`, `WEB_PORT=18080`. Funciones `compose(args, env)` (con `child_process.execFileSync('docker', ['compose','-p','vecinopay-e2e',...])`), `fijarReloj(isoLima)`, `esperarApi()` (reintenta `GET http://localhost:13000/api/health` o la ruta que ya exista, máx. 60 s). |
| `e2e/global-setup.ts` | `compose(['down','-v'])` solo del proyecto e2e, luego `up -d --build` con `RELOJ_FIJO=2026-09-22T12:00:00-05:00`, `esperarApi()`. |
| `e2e/global-teardown.ts` | `compose(['down','-v'])`, salvo `E2E_MANTENER=1` (para depurar). |
| `e2e/ayudas/sesion.ts` | `entrarDueno(page, usuario)`, `entrarCliente(page, dni, clave)`, `entrarAdmin(page)`; usan las rutas `/login` y `/m/login`. |
| `e2e/ayudas/dinero.ts` | `texto(page)` que normaliza `S/ 228.42` y `228,42`; evita fallar por separador de miles o espacios. Sin cálculos: solo compara cadenas del informe. |
| `e2e/specs/01-juego1-semillas.spec.ts` | Juego 1 con reloj 22/09 y listados (sección 3.1). |
| `e2e/specs/02-juego2-cuotas.spec.ts` | Juego 2: D04 con reloj 15/09, D05, activación C02 y C03/C06 (3.2). |
| `e2e/specs/03-juego1-pagos.spec.ts` | Relojes 26/09 12:00, 26/09 17:30 y 01/10: D07 y C07 (3.3). Va al final porque consume el listado. |
| `e2e/specs/04-rf09.spec.ts` | RF09 (sección 4). |
| `e2e/specs/05-multitienda.spec.ts` | Aislamiento (sección 4). |
| `.gitignore` | Añadir `test-results/`, `playwright-report/`. |
| `docs/guia_demo.md` | Sección 5. |
| `package.json` (raíz) | Scripts: `"test:e2e": "playwright test"`, `"test:e2e:instalar": "playwright install chromium"`, `"test:e2e:ui": "playwright test --ui"`. No se añade a `npm test` (tarda y requiere Docker). |
| `README.md`, `docs/decisiones.md` | Una línea de cómo correr `test:e2e` y la decisión del proyecto Docker aparte. |

Orden de los specs: Playwright ordena por nombre de archivo; los prefijos 01 a 05 fijan la secuencia. Cada spec empieza con `test.describe.configure({ mode: 'serial' })`.

Compose: no hay que modificar `docker-compose.yml`; `name: vecinopay` queda anulado por `-p`. Solo se verifica que `RELOJ_FIJO`, `DB_PORT`, `API_PORT`, `WEB_PORT` se pasan por el entorno del proceso hijo. La web llama a `/api` por el nginx del contenedor (`apps/web/nginx.conf`), así que el navegador solo necesita el puerto web; el puerto de la API se usa para el health check.

Cambio de reloj: `fijarReloj('2026-10-01T12:00:00-05:00')` = `compose(['up','-d','api'], { RELOJ_FIJO: ... })` + `esperarApi()`. Las sesiones se vuelven a abrir tras cada reinicio (no se reusa `storageState`), para no depender de la caducidad del token frente al reloj fijo (ver riesgos).

## 3. Escenarios (reloj inicial 22/09/2026 12:00; usuarios de README)

Los localizadores usan `getByRole` y `getByText`; si una pantalla no los permite, se añade `data-testid` mínimo en la web (cambio permitido en esta fase, sin alterar la lógica).

### 3.1 Juego 1 sobre semillas (`01-juego1-semillas`)
Usuario `rosa@vecinopay.test` / `Tienda#2026`.

| Paso | Pantalla | Se ve (Tablas 16 y 17) |
|---|---|---|
| 1 | A01 login mala clave, luego correcta | Mensaje de credenciales; entra a D01. |
| 2 | D01 | 502.72, 228.42, 4.80, 0.00, 20.01 (fase-4 11.2). |
| 3 | D06 `EC-202609-00001` | Cinco compras con capital 44.20, 32.80, 63.82, 30.50, 52.30; intereses 1.63, 0.93, 1.40, 0.41, 0.43; totales 45.83, 33.73, 65.22, 30.91, 52.73; pie 223.62, 4.80, 228.42; asterisco en T-000245 y T-000278 (después de las 17:00); franja de T-000301 (21.30, ciclo 20/10, pago 26/10/2026). |
| 4 | D06, fecha 16/09/2026 en "valor de hoy" | Descuento 2.35 y valor neto 226.07. |
| 5 | D04, cliente Luis, producto P003 x 99.900 (999.00) | Aviso de crédito; al Confirmar, error con **255.08** (no 276.38: T-000301 ya existe en las semillas; ver fase-4 línea 750). No se crea ninguna compra: la lista de compras sigue igual. |
| 6 | Admin `admin@vecinopay.test` / `Admin#2026`, A05 | Fila `RECHAZO` con importe oculto `S/ ***` (el informe pide intento en auditoría, 6.4 línea 3409). |

### 3.2 Juego 2 (`02-juego2-cuotas`)
| Paso | Reloj | Pantalla | Se ve (Tablas 18 a 20) |
|---|---|---|---|
| 1 | 15/09/2026 10:35 | D04, María, olla y hervidor, 3 cuotas, **sin confirmar** | Lista 257.80, contado 249.80, fecha de pago 26/09/2026, gracia 11 días, P' 261.07, cuotas 93.25, 93.25, 93.26, intereses 18.69, interés de gracia 3.27, TCEA 51.09 %, VAN 20.01, flujo 269.81 (91.33 + 89.91 + 88.56). No se confirma porque T-000284 ya existe y duplicaría el juego. |
| 2 | 22/09/2026 12:00 | D05 `T-000284` | Tabla 19: 261.07/9.14/84.11/93.25/176.96; 176.96/6.40/86.85/93.25/90.11; 90.11/3.15/90.11/93.26/0.00; totales 18.69, 261.07, 279.76. Cuota 3 de 93.26. Flujo de caja con VAN 20.01 y 269.81. |
| 3 | 22/09 | D03 María | Código `MDR-7K2Q`, TNA 42 % mensual, 3.5000000 % y 51.1068657 %. Condiciones bloqueadas con motivo. |
| 4 | 22/09 | C02 `/m/activar`: DNI 40000002, código `MDR-7K2Q`, celular 999000111, clave `Vecino#2026`, aceptar datos | Entra a C03. Una segunda activación con el mismo código falla con mensaje. |
| 5 | 22/09 | C03 María | Sin listado emitido (su primera cuota entra al corte del 20/10, semillas línea 129); crédito disponible según el motor (se lee de D01/D03 y se compara, no se escribe a mano); tasa nominal 42 %. |
| 6 | 22/09 | C05 María | Estado sin listado ("aún no tienes compras listadas" o el texto vigente de la pantalla). |
| 7 | 22/09 | C06 María | Cuotas 93.25, 93.25, 93.26; próxima cuota 26/10/2026 de 93.25; TCEA 51.09 %; tarjeta de gracia con g = 11 y 3.27. |
| 8 | 22/09 | C06 y C07 | Sin pagos en C07. |

La mora de la cuota 2 pagada el 30/11 (0.12 y 93.37, Tabla 20) y las deudas a fecha las cubre `juegos.e2e.spec.ts` por HTTP. No se repite en navegador salvo que D05 ya la muestre; en ese caso es un paso opcional con reloj 30/11/2026 12:00.

### 3.3 Pagos del juego 1 (`03-juego1-pagos`, al final)
Usuario Rosa, ruta D07 `listados/:id/pago`.

| Reloj | Se ve y se hace |
|---|---|
| 26/09/2026 12:00 | D07: total 228.42, mora 0.00 (pago puntual). No se paga. |
| 26/09/2026 17:30:00 | D07: pago cuenta como 27/09, 1 día de mora, mora 0.06, total 228.48. No se paga. |
| 01/10/2026 12:00 | D07: mora 0.30 (5 días), total 228.72. Se ingresa 200.00: rechazo con mensaje que indica el importe 228.72. Se ingresa 228.72: aceptado; imputación mora 0.30, interés 4.80, capital 223.62 (suman 228.72); crédito disponible 478.70. Un segundo intento sobre el mismo listado queda bloqueado. |
| 01/10/2026 12:00 | Login Luis (C01, `45872316` / `Vecino#2026`): C07 muestra el pago y la imputación 0.30, 4.80, 223.62; C03 disponible 478.70; C05 ya sin saldo por pagar del ciclo cerrado (o con T-000301 solo en el ciclo siguiente). |

## 4. RF09 y multitienda en el navegador

**RF09 (`04-rf09`)**, 2.ª sesión como Luis y como María (tras activar), reloj 22/09:
1. Se visitan C03, C04, C05, C06, C07, C08 y C09. En cada una, `page.locator('body').innerText()` no contiene: `VAN`, `COK`, `contado` (en minúscula o mayúscula), `249.80`, `20.01`, `269.81`, `TIR`.
2. Un `page.on('response')` recoge los cuerpos de `/api/mi/*`; se comprueba que ninguna clave de objeto, en cualquier nivel, sea `van`, `cok`, `cokTea`, `montoContado`, `precioContado` ni `flujo`, y que ninguna cadena sea `20.01` o `249.80`. Si C09 incluye texto pedagógico con la palabra "contado", se ajusta la lista a los valores y claves, no a las palabras (decisión del implementador, anotarla).
3. Prueba positiva espejo: Rosa en D05 sí ve 20.01 y 269.81. Evita falsos verdes.
4. Luis intenta abrir `/dueno/clientes` y `/admin`: la guarda lo devuelve a `/m/...` o a login. Con `page.request` y su token, `GET /api/clientes` responde 403.

**Multitienda (`05-multitienda`)**:
1. Carlos (`carlos.demo@vecinopay.test`, Bodega El Vecino y Pollería El Buen Sabor): ve el selector; D03 no lista a Luis ni a María; D02 muestra BOD01 y no P012 ni P003; al cambiar de tienda el catálogo pasa a POL01. Rosa no ve selector.
2. Con el id de Luis (obtenido en una llamada autenticada de Rosa a la API, helper de `ayudas`), Carlos abre `/dueno/clientes/<id>` y `/dueno/listados/<id>` y se muestra "no encontrado" o error, nunca datos de Luis. Los listados de Rosa tampoco aparecen en D06 de Carlos.
3. Ana (Panadería San Martín): D01 con "Aún no tienes clientes".
4. Elena (tienda INACTIVA): el login es rechazado con mensaje.
5. Las pruebas de HTTP de `aislamiento.e2e` siguen siendo la red principal; aquí solo se comprueba que la web no filtra datos.

## 5. Guía de la demo (`docs/guia_demo.md`)

Contenido: requisitos (Docker Desktop, WSL 2, Node 22), arranque y reinicio limpio, tabla de usuarios, tabla de relojes con el comando PowerShell, guion, tiempos, qué decir en cada pantalla, plan B.

Guion de unos 15 minutos (reloj 22/09 por defecto; reiniciar con `docker compose down -v` antes de presentar):

| Min | Acción | Mostrar |
|---|---|---|
| 0-1 | Contexto: Minimarket Doña Rosa, COK 20 %, corte día 20 a las 17:00 | Informe 6.4 |
| 1-3 | Admin: A02 y A05 (aislamiento, `S/ ***`) | Sin montos para el administrador |
| 3-6 | Rosa: D01, D06 (Tabla 16, asteriscos, 228.42; valor de hoy 16/09: 2.35 y 226.07) | Cifras al céntimo |
| 6-8 | Rosa: D04, Luis P003 x 99.900: rechazo con 255.08 (aclarar 276.38 en la prueba desde cero) | Regla del límite |
| 8-11 | Reloj 15/09 10:35: D04 de María, P' 261.07, cuotas, TCEA 51.09 %, VAN 20.01. Reloj 22/09: D05 (T19) | Juego 2 |
| 11-13 | Reloj 01/10: D07, 200.00 rechazado, pago 228.72 e imputación; disponible 478.70 | Juego 1, mora |
| 13-15 | Celular (375 px): activar a María con `MDR-7K2Q`, C03, C06; Luis en C07. Subrayar que no ven VAN ni COK | RF09 |

Relojes (PowerShell): `$env:RELOJ_FIJO='<iso>'; docker compose up -d api`. Para volver al inicio: `Remove-Item Env:RELOJ_FIJO` y `docker compose up -d api` (queda en 22/09 por defecto) o `docker compose down -v` si ya se pagó el listado.

Orden obligatorio: el pago del listado va al final, porque se paga una sola vez; después de pagar hay que recrear con `down -v`. La activación de María también se consume una vez.

Plan B si falla Docker (en este orden):
1. `docker compose down -v` y `up -d --build` de nuevo; revisar `docker compose logs db-init api`.
2. Solo `npm run test:integracion` y `npm test` (cifras del informe sin navegador), más capturas ya tomadas en `docs/mockups/` y el informe de Playwright (`playwright-report/`).
3. Mostrar el video o las capturas de una corrida previa (grabar en el ensayo con `video: 'on'` de Playwright en una corrida con `E2E_VIDEO=1`).
4. Swagger no está disponible sin la API; en ese caso, el motor `packages/finance` con `npm test -w packages/finance` demuestra las Tablas 16 a 20 sin Docker.

## 6. Plan de implementación

| Paso | Commit | Entregable | Criterio verificable |
|---|---|---|---|
| 1 | `fase-6: base de playwright y entorno docker aparte` | Dependencia, `playwright.config.ts`, `entorno.ts`, setup/teardown, scripts, `.gitignore`, spec de humo (login de Rosa y D01 = 502.72) | `npm run test:e2e` levanta `vecinopay-e2e`, pasa y lo baja; `docker compose ls` no muestra cambios en `vecinopay`; los datos de `vecinopay` (volumen `vecinopay_datos-sql`) siguen intactos |
| 2 | `fase-6: e2e del juego 1 sobre semillas` | `01-...` | Cifras de 3.1 en verde |
| 3 | `fase-6: e2e del juego 2 y activacion del cliente` | `02-...`, helper de reloj | Cifras de 3.2 en verde; D04 no crea compra (conteo igual en D05) |
| 4 | `fase-6: e2e de pagos con cambio de reloj` | `03-...` | 228.42, 228.48, 228.72, 200.00 rechazado, 0.30/4.80/223.62, 478.70 |
| 5 | `fase-6: e2e de rf09 y multitienda` | `04-...`, `05-...` | Pruebas positivas y negativas verdes; romper a propósito un filtro de `tienda_id` o añadir `van` a `/api/mi/resumen` en una rama local las pone en rojo (meta-prueba manual, anotada) |
| 6 | `fase-6: guia de la demo y readme` | `docs/guia_demo.md`, README, `decisiones.md` | Adrián sigue la guía de cero a fin y el tiempo es de 15 minutos o menos; pasadas 2 corridas seguidas de `test:e2e` sin fallos |

Después de cada paso: `npm run lint`, `npm test` y revisión. Cierre: revisor (diff y pruebas), auditor (cada cifra contra 6.4), y aprobación de Adrián.

Si el plazo se acorta, se corta en este orden: video de respaldo, paso opcional del 30/11, `05-multitienda` ítems 3 y 4, responsive de la guía. No se corta: pasos 1 a 4 y RF09.

## 7. Riesgos y supuestos
- **Estado compartido entre specs:** pagar y activar consumen datos. Mitigación: orden fijo, 1 worker y reinicio limpio por corrida (`globalSetup`). Un spec suelto no es repetible sin el setup completo; se documenta.
- **Reinicio de la API (30 s aprox.):** cada cambio de reloj reinicia el contenedor y las sesiones previas se abren de nuevo. Agrupar los pasos por reloj para limitar a 6 reinicios.
- **Caducidad del JWT frente al reloj fijo:** si el token se firma con el reloj fijo y se valida con el real (o al revés), puede caducar de inmediato. Se detecta en el paso 1; si ocurre, es un defecto de la API que se corrige allí (no es regla de negocio).
- **Tiempo del build:** `up --build` de la primera vez tarda varios minutos; las siguientes usan caché. `timeout` de setup: 10 min.
- **Puertos 11433, 13000 y 18080 ocupados:** configurables por `E2E_DB_PORT`, `E2E_API_PORT`, `E2E_WEB_PORT`.
- **Locators frágiles:** si faltan textos estables, se añaden `data-testid` mínimos. Es un cambio pequeño y sin efecto en lógica.
- **276.38 y 6.4 línea 3408:** sobre las semillas el rechazo muestra 255.08 porque T-000301 ya existe. Es coherente con el criterio "Rechazada" de la Tabla 17; el 276.38 solo se prueba en `juegos.e2e.spec.ts`, que parte de cero. No hay contradicción del informe, solo estado distinto (misma nota de fase-4).
- **Supuesto, juego completo desde cero en navegador:** no se implementa (alta de tienda, 5 compras, 5 relojes y corte). El prompt exige que "el recorrido de la sección 6.4 funcione de punta a punta"; se cumple con semillas por navegador y desde cero por HTTP. Si Adrián exige lo segundo por navegador, es trabajo extra de unas 4 a 6 horas; no se marca como bloqueo porque no cambia cifras, pantallas ni RF.
- **Textos exactos de C05 sin listado y de C03 de María:** no figuran en el informe; el implementador los lee de la pantalla ya hecha y los fija en el test. No se inventan cifras.
- **Mora de cuota (Tabla 20, 0.12/93.37) en navegador:** solo si D05 o D07 permiten pagar cuotas con reloj 30/11; si no, queda en API.
- Ninguna decisión requiere **[ESCALAR]**.
