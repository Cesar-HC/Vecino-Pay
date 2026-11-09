# VecinoPay

Aplicación web multitienda que reemplaza el "cuaderno del fiado" de las tiendas de barrio.
Trabajo final del curso Finanzas e Ingeniería Económica (FIE 7651, ciclo 2026-20).

La fuente de verdad es el informe **Trabajo_Parcial_FIE_7651_VecinoPay_v8.docx**: la app
reproduce sus reglas, fórmulas (sección 6.3), juegos de prueba (6.4) y modelo de datos (sección 8).

## Estructura

```
apps/api          API en NestJS (TypeScript)
apps/web          Web en React + Vite + Tailwind (admin, dueño y cliente móvil)
packages/finance  Motor financiero en TypeScript puro, con pruebas en Jest
db/init           Scripts de PostgreSQL: esquema, semillas y privilegios de la API
scripts           Utilidades de la base de datos (roles, crear, recrear, verificar) y de la demo
```

## Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| PostgreSQL | 17, con el servicio activo (puerto 5432) | Base de datos. pgAdmin sirve como cliente |
| Node.js | 22 LTS o superior (mínimo 20; probado con 26) | API, web y pruebas |
| Git | 2.x | Control de versiones |

No se usa Docker. `psql` se busca en el PATH y en `C:\Program Files\PostgreSQL\17\bin`; si está en otro sitio, define `PSQL_BIN` en `.env`.

> El motor de base de datos cambió de SQL Server a PostgreSQL por decisión del grupo (ver `docs/escalaciones.md`).
> El informe v8 aún dice SQL Server en la sección 8; el Word debe corregirse.

## Levantar todo

```powershell
copy .env.example .env
npm install
npm run db:roles    # una sola vez: crea los roles vecinopay_owner y vecinopay_app (pide la clave de postgres)
npm run db:crear    # crea la base vecinopay con el esquema y las semillas
npm run demo        # compila y levanta la API y la web
```

La primera vez compila (1 o 2 minutos). Luego abre:

- Web: http://localhost:8080
- API: http://localhost:3000/api/salud
- Documentación de la API (Swagger): http://localhost:3000/api/docs
- PostgreSQL: `127.0.0.1:5432`, base `vecinopay`. En pgAdmin entra con el usuario `vecinopay_owner` (la clave está en `.env`). La API usa `vecinopay_app`, que no puede borrar ni cambiar el esquema.

Para apagar la demo, pulsa Ctrl+C en esa terminal. Para borrar y recargar la base: `npm run db:recrear -- --confirmar`.
La web solo escucha en tu equipo (127.0.0.1).

## Desarrollo local

```powershell
npm install
npm test           # pruebas del motor financiero, unitarias de la API y de la web
npm run test:integracion   # API contra una base desechable vecinopay_test en tu PostgreSQL, sin tocar vecinopay
npm run dev:api    # API en http://localhost:3000
npm run dev:web    # web en http://localhost:5173 (redirige /api a la API)
```

## Base de datos y semillas

`db/init` crea las 11 tablas de la sección 8 del informe, más las 3 columnas registradas en
`docs/decisiones.md`, y carga los juegos de prueba 1 y 2, con el estado al 22/09/2026. Los juegos están solo en
Minimarket Doña Rosa; 5 tiendas de demostración, sin clientes ni compras, llenan las pantallas del administrador. Los scripts se
aplican con `npm run db:iniciar` y no repiten nada: si la tienda ya existe, las semillas no cambian. Para volver
al estado inicial (o aplicar un cambio de esquema) usa `npm run db:recrear -- --confirmar`, que borra todos los datos de `vecinopay`.

```powershell
npm run db:verificar   # compara la BD con las cifras del informe; falla si algo no coincide
npm run db:estado      # versión de PostgreSQL, codificación, zona horaria y tablas
```

La verificación solo vale con las semillas recién cargadas, antes de operar en la demo. Sus pruebas se
revierten, pero pueden dejar huecos en los id autogenerados, lo que no afecta a ninguna cifra.

Usuarios de demo (solo para desarrollo local):

| Usuario | Perfil | Contraseña |
|---|---|---|
| `admin@vecinopay.test` | Administrador | `Admin#2026` |
| `rosa@vecinopay.test` | Dueña de Minimarket Doña Rosa | `Tienda#2026` |
| `45872316` | Luis Quispe, cuenta activada | `Vecino#2026` |
| `carlos.demo@vecinopay.test` | Dueño de 2 tiendas: muestra el selector | `Tienda#2026` |
| `ana.demo@vecinopay.test` | Dueña de Panadería San Martín, sin clientes | `Tienda#2026` |
| `jorge.demo@vecinopay.test` | Dueño de Librería El Estudiante, sin clientes | `Tienda#2026` |
| `elena.demo@vecinopay.test` | Dueña de Peluquería Estilo, en BAJA: no puede entrar | `Tienda#2026` |

María Huamán (DNI `40000002`) queda sin activar para demostrar la activación con el código `MDR-7K2Q`.
Los datos que no salen del informe están marcados como `FICTICIO (demo)` en `db/init/02_semillas.sql`.

## Probar la API

Por defecto la demo corre con la fecha fija del 22/09/2026 (`RELOJ_FIJO`), que es la de D01 y C03.
Para otra fecha, detén la demo (Ctrl+C) y levanta la API con otra fecha; vacía, usa la hora real. La API no arranca en producción si tiene valor.

```powershell
$env:RELOJ_FIJO='2026-09-26T17:30:00-05:00'; npm run start:api   # y npm run start:web en otra terminal
```

Todas las rutas están en Swagger (http://localhost:3000/api/docs), con su botón **Authorize** para el token de
`POST /api/auth/login`. Con el reloj fijo no hay corte automático: lo ejecuta el administrador con
`POST /api/cortes/ejecutar` o con el botón de A02 en la web, solo para hoy y después de las 17:00:00.

## Probar la web

Abre http://localhost:8080 e inicia sesión con los usuarios de demo. Con el reloj en 22/09/2026, D01 de Rosa muestra
S/ 502.72, S/ 228.42 (26/09/2026), S/ 4.80, S/ 0.00 y S/ 20.01.

Para el pago del juego 1, pon el reloj en `2026-10-01T12:00:00-05:00` y abre Pagos con Rosa: el total es S/ 228.72,
un pago de S/ 200.00 se rechaza y S/ 228.72 se acepta, con imputación S/ 0.30, S/ 4.80 y S/ 223.62. Un listado se paga
una sola vez: repetirlo exige recargar las semillas con `npm run db:recrear -- --confirmar`, que borra todos los datos de `vecinopay`.

## Probar el celular (cliente)

Abre http://localhost:8080/m/login (mejor con el ancho de un celular, 375 px). Luis entra con `45872316` y `Vecino#2026`: C03 muestra
S/ 228.42, S/ 223.62 de capital, S/ 4.80 de interés y S/ 255.08 disponibles. María se activa en `/m/activar` con el DNI `40000002` y el código `MDR-7K2Q`:
C06 muestra las cuotas S/ 93.25, S/ 93.25 y S/ 93.26 y la TCEA de 51.09 %.

## Pruebas de navegador y guía de la demo

`npm run test:e2e:instalar` (una vez) y `npm run test:e2e` recorren los juegos 1 y 2 y RF09 en el navegador (26 pruebas, unos 2 minutos).
Usan su propia base `vecinopay_e2e` y los puertos 13000 y 18080, y no tocan los datos de `vecinopay`. El guion de 15 minutos para presentar está en
`docs/guia_demo.md`.

## Reglas fijas del sistema

- Zona horaria **America/Lima** en todos los procesos y en los cálculos.
- Hora de corte **17:00:00**: un registro hecho después de esa hora cuenta como del día siguiente
  (fecha operativa). No es configurable.
- Días entre fechas con calendario exacto (meses reales y años bisiestos).
- Montos con `decimal.js` y redondeo `Red(x) = floor(100x + 0.5)/100` en cada hito.

## Fases

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Monorepo, README, zona America/Lima | Aprobada |
| 1 | Esquema SQL de 11 tablas y semillas (juegos 1 y 2) | Aprobada |
| 2 | Motor financiero con pruebas al céntimo | Aprobada |
| 3 | API: auth, roles, multitienda, compras, corte, listados, pagos, cronogramas, auditoría | Aprobada |
| 4 | Web del administrador y del dueño (A01–A05, D01–D08) | Auditada (CONFORME), falta la aprobación de Adrián |
| 5 | Vista móvil del cliente (C01–C09) | Auditada (CONFORME), falta la aprobación de Adrián |
| 6 | Pruebas E2E y guía para la demo | Auditada (CONFORME); falta la aprobación de Adrián |
| Migración | PostgreSQL 17 sin Docker, mismas 11 tablas y mismas cifras | En revisión (ver `docs/diseno/migracion-postgres.md`) |

## Uso de inteligencia artificial

El código de este repositorio fue generado con Claude (Anthropic) y revisado por el grupo.
Esto debe quedar declarado en la sección 9 del informe.
