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
db/init           Scripts de SQL Server que se ejecutan en orden al levantar
```

## Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Docker Desktop | 4.x con WSL 2 | Levantar SQL Server, API y web con un comando |
| Node.js | 22 LTS (mínimo 20) | Desarrollo local y pruebas |
| Git | 2.x | Control de versiones |

SQL Server necesita al menos 2 GB de RAM libres para Docker.

> Usamos Node 22 porque Node 20 dejó de recibir soporte en abril de 2026. El código también corre en 20.

## Levantar todo con un comando

```powershell
copy .env.example .env
docker compose up -d --build
```

La primera vez tarda varios minutos (descarga SQL Server y compila). Luego abre:

- Web: http://localhost:8080
- API: http://localhost:3000/api/salud
- Documentación de la API (Swagger): http://localhost:3000/api/docs
- SQL Server: `localhost,1433`, usuario `sa`, contraseña la de `.env`

Para apagar: `docker compose down`. Para borrar también la base de datos: `docker compose down -v`.

## Desarrollo local (sin Docker para API y web)

```powershell
npm install
npm run db:up      # solo SQL Server en Docker
npm test           # pruebas del motor financiero
npm run dev:api    # API en http://localhost:3000
npm run dev:web    # web en http://localhost:5173 (redirige /api a la API)
```

## Base de datos y semillas

`db/init` crea las 11 tablas de la sección 8 del informe, más las 3 columnas registradas en
`docs/decisiones.md`, y carga los juegos de prueba 1 y 2, con el estado al 22/09/2026. Los scripts se
aplican en cada arranque y no repiten nada: si la tienda ya existe, las semillas no cambian. Para volver
al estado inicial (o aplicar un cambio de esquema) usa `docker compose down -v`, que borra todos los datos.

Si `db-init` falla con `Invalid column name 'giro'`, tu volumen tiene el esquema anterior y la API no
arrancará hasta recrearlo con ese comando.

```powershell
npm run db:verificar   # compara la BD con las cifras del informe; falla si algo no coincide
```

La verificación solo vale con las semillas recién cargadas, antes de operar en la demo. Sus pruebas se
revierten, pero pueden dejar huecos en los id autogenerados, lo que no afecta a ninguna cifra.

Usuarios de demo (solo para desarrollo local):

| Usuario | Perfil | Contraseña |
|---|---|---|
| `admin@vecinopay.test` | Administrador | `Admin#2026` |
| `rosa@vecinopay.test` | Dueña de Minimarket Doña Rosa | `Tienda#2026` |
| `45872316` | Luis Quispe, cuenta activada | `Vecino#2026` |

María Huamán (DNI `40000002`) queda sin activar para demostrar la activación con el código `MDR-7K2Q`.
Los datos que no salen del informe están marcados como `FICTICIO (demo)` en `db/init/02_semillas.sql`.

## Reglas fijas del sistema

- Zona horaria **America/Lima** en todos los contenedores y en los cálculos.
- Hora de corte **17:00:00**: un registro hecho después de esa hora cuenta como del día siguiente
  (fecha operativa). No es configurable.
- Días entre fechas con calendario exacto (meses reales y años bisiestos).
- Montos con `decimal.js` y redondeo `Red(x) = floor(100x + 0.5)/100` en cada hito.

## Fases

| Fase | Entregable | Estado |
|---|---|---|
| 0 | Monorepo, docker-compose, README, zona America/Lima | En revisión |
| 1 | Esquema SQL de 11 tablas y semillas (juegos 1 y 2) | Aprobada |
| 2 | Motor financiero con pruebas al céntimo | Aprobada |
| 3 | API: auth, roles, multitienda, compras, corte, listados, pagos, cronogramas, auditoría | Pendiente |
| 4 | Web del administrador y del dueño (A01–A05, D01–D08) | Pendiente |
| 5 | Vista móvil del cliente (C01–C09) | Pendiente |
| 6 | Pruebas E2E y guía para la demo | Pendiente |

## Uso de inteligencia artificial

El código de este repositorio fue generado con Claude (Anthropic) y revisado por el grupo.
Esto debe quedar declarado en la sección 9 del informe.
