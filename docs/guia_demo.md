# Guía de la demo de VecinoPay

Recorrido de unos 15 minutos que reproduce la sección 6.4 del informe (juegos 1 y 2) en la web y en el celular.
Todas las cifras salen del informe v8 y las comprueba la suite de navegador (`npm run test:e2e`).

## Antes de presentar

Requisitos: PostgreSQL 17 activo, Node 22 o superior y el `.env` copiado de `.env.example` (con `npm run db:roles` ya ejecutado una vez).

1. Deja la base en su estado inicial. **Borra todos los datos de la base `vecinopay`:**
   ```powershell
   npm run db:recrear -- --confirmar
   npm run demo
   ```
2. Espera unos segundos (la primera vez compila) y abre http://localhost:8080. Arriba debe decir "reloj fijo en 22/09/2026 12:00:00".
3. Ensaya una vez con la guía. Pagar el listado y activar a María **se pueden hacer una sola vez**: después hay que repetir el paso 1.

## Usuarios

| Usuario                      | Perfil                                                  | Clave                       |
| ---------------------------- | ------------------------------------------------------- | --------------------------- |
| `admin@vecinopay.test`       | Administrador del sistema (elegir ese perfil al entrar) | `Admin#2026`                |
| `rosa@vecinopay.test`        | Dueña de Minimarket Doña Rosa                           | `Tienda#2026`               |
| `45872316`                   | Luis Quispe, cliente (portal móvil `/m/login`)          | `Vecino#2026`               |
| `40000002`                   | María Huamán, cliente sin activar (código `MDR-7K2Q`)   | la que ella cree al activar |
| `carlos.demo@vecinopay.test` | Dueño de 2 tiendas (muestra el selector)                | `Tienda#2026`               |
| `ana.demo@vecinopay.test`    | Dueña sin clientes (resumen vacío)                      | `Tienda#2026`               |

## Cómo cambiar el reloj

La demo usa un reloj fijo. Para cambiarlo, detén la demo con Ctrl+C y levanta la API con otra fecha (la web puede quedar compilada):

```powershell
$env:RELOJ_FIJO='2026-10-01T12:00:00-05:00'; npm run start:api   # y npm run start:web en otra terminal
```

Para volver a 22/09/2026 12:00: `Remove-Item Env:RELOJ_FIJO; npm run demo` (con el `.env`, que ya trae esa fecha).

## Guion

| Min   | Reloj         | Qué hacer                                                                                                   | Qué se ve                                                                                                                                           | Qué decir                                                                                   |
| ----- | ------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 0-1   | 22/09         | Contexto                                                                                                    | Minimarket Doña Rosa, COK 20 %, corte el día 20 a las 17:00, pago el día 26                                                                         | Reemplaza el cuaderno de fiado                                                              |
| 1-3   | 22/09         | Administrador: A02 y A05                                                                                    | Conteos, gráficos y auditoría con `S/ ***`                                                                                                          | El administrador no ve montos                                                               |
| 3-6   | 22/09         | Rosa: D01 y D06 (`EC-202609-00001`)                                                                         | 502.72, 228.42, 4.80, 0.00, 20.01. Cinco compras con 223.62 + 4.80 = 228.42 y asteriscos en T-000245 y T-000278                                     | El interés se redondea compra por compra. Lo posterior a las 17:00 cuenta del día siguiente |
| 6     | 22/09         | En D06, fecha 16/09/2026                                                                                    | Descuento S/ 2.35 y valor neto S/ 226.07                                                                                                            | Valor de hoy de lo que le deben                                                             |
| 6-8   | 22/09         | D04: Luis, Aceite 1 L × 99.900, Confirmar                                                                   | Rechazo con **255.08**                                                                                                                              | Supera el crédito. El 276.38 del informe es la corrida desde cero (ver nota)                |
| 8-11  | 15/09 10:35   | D04: María, olla y hervidor, En cuotas, 3 cuotas. **No confirmar**                                          | P' 261.07, g = 11, cuotas 93.25, 93.25 y 93.26, TCEA 51.09 %, VAN 20.01                                                                             | Juego 2                                                                                     |
|       | 22/09         | D05: T-000284                                                                                               | Tabla 19 y flujo de caja: 269.81 − 249.80 = 20.01                                                                                                   | El VAN lo ve solo la tienda                                                                 |
| 11-13 | 01/10 12:00   | D07: pagar el listado de Luis                                                                               | Mora 0.30 y total 228.72. 200.00 se rechaza con "Monto correcto: S/ 228.72". Con 228.72: mora 0.30, interés 4.80, capital 223.62. Disponible 478.70 | Pago completo y prelación                                                                   |
| 13-15 | 22/09 o 01/10 | Celular (375 px): activar a María en `/m/activar` con `40000002` y `MDR-7K2Q`; luego C03 y C06. Luis en C07 | María: cuotas y TCEA. Luis: imputación del pago                                                                                                     | Los clientes no ven VAN ni COK (RF09)                                                       |

**Orden obligatorio:** el pago de Luis va después de D04, D05 y D06, porque cambia el listado. Activar a María también se consume una vez.

**Nota sobre 276.38.** El informe (6.4) dice que antes de la compra de 999.00 Luis tiene S/ 276.38 disponibles. Con las semillas ya cargadas, la compra T-000301 (S/ 21.30) existe, así que el disponible es **255.08**. En los dos casos la compra se rechaza, que es lo que pide la Tabla 17. El 276.38 se comprueba desde cero en `apps/api/test/integracion/juegos.e2e.spec.ts`.

## Si algo falla (plan B)

1. `npm run db:recrear -- --confirmar` y `npm run demo`. Si sigue, mira el registro de esa terminal y ejecuta `npm run db:estado`.
2. Sin base de datos, las cifras del informe se demuestran con las pruebas: `npm test -w packages/finance` (motor financiero, Tablas 16 a 20) y `npm test`.
3. Muestra el informe de la suite de navegador (`playwright-report/`, se abre con `npx playwright show-report`) o una corrida grabada con `$env:E2E_VIDEO='1'; npm run test:e2e`.
4. Capturas de referencia en `docs/mockups/`.

## Suite de navegador (opcional, antes de la demo)

```powershell
npm run test:e2e:instalar   # una sola vez: descarga Chromium
npm run test:e2e            # 26 pruebas, unos 2 minutos
```

Los specs van en orden y comparten estado (pagar y activar se consumen una vez): si uno falla a la mitad, los siguientes pueden fallar en cascada; se repite la corrida completa. Corre con su propia base `vecinopay_e2e` (puertos 18080 y 13000), sembrada al inicio y borrada al terminar. **No toca los datos de la base `vecinopay`**, así que se puede correr con la demo levantada. Para dejarlo arriba y depurar: `$env:E2E_MANTENER='1'`. Para reutilizar un entorno ya levantado: `$env:E2E_REUSAR='1'`. Para omitir la compilación: `$env:E2E_SIN_BUILD='1'`.
