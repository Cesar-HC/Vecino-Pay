# Diseño de la fase 3: API de VecinoPay

Fuentes, en orden: `docs/informe_v8.txt`, `docs/prompt_desarrollo.md`, `CLAUDE.md`. Si se contradicen, gana el informe.
Las figuras del informe son imágenes y no están en el `.txt`. Lo que dependa de un mockup se marca como "por comparar" (sección 15).
Nada de este documento se ejecutó. Lo que depende de una prueba real se concentra en el paso 0 (sección 14) y en la sección 15.

## 1. Alcance y cobertura

### 1.1 Requisitos

| RF | Qué cubre la fase 3 | Queda fuera |
|---|---|---|
| RF01 | Login por perfil, JWT, auditoría de cada operación | |
| RF02 | Alta, edición y baja de tiendas con credenciales del dueño | |
| RF03 | Alta, edición y baja de productos | Subida de archivo: `imagen_url` recibe una URL `.jpg` o `.png` (T25 define un texto de 300). Se evalúa en fase 4 |
| RF04 | Clientes, condiciones, TED y código de activación | |
| RF05 | Cronograma francés con gracia total | |
| RF06 | Compra a fin de mes y rechazo por límite | |
| RF07 | Pago exacto, mora, prelación | |
| RF08 | Corte, listado ordenado, ítem de mora aparte | PDF y WhatsApp de D06: se resuelven en la web (fase 4) |
| RF09 | TCEA y VAN | |
| RF10 | Datos de A02, D01, C03 y C04 | Gráficos: fases 4 y 5 |
| RF11 | Usuarios y auditoría | |
| RF12 | Activación y consentimiento | |
| RF13 | Solo el ejemplo de C09 con una compra real del cliente | **No cubierto:** globos de ayuda, D08 y el texto de C09 son contenido de la web (fases 4 y 5) |

También queda fuera: anular compras. T27 admite `ANULADA`, pero ningún RF ni pantalla define esa operación. La API excluye ese estado de todos los cálculos y no ofrece ruta para crearlo.

### 1.2 Pantallas

| Pantalla | Rutas (sección 9) | Pantalla | Rutas (sección 9) |
|---|---|---|---|
| A01 | `POST /auth/login` | D06 | `/listados*` |
| A02 | `GET /plataforma/resumen` | D07 | `GET /listados/:id/liquidacion`, `POST /listados/:id/pago` |
| A03 | `/tiendas*` | D08 | **Sin API** (contenido estático) |
| A04 | `/usuarios*` | C01 | `POST /auth/login` |
| A05 | `GET /auditoria` | C02 | `POST /auth/activar` |
| D01 | `GET /negocio/resumen` | C03 | `GET /mi/resumen` |
| D02 | `/productos*` | C04 | `GET /auth/yo`, `GET /mi/resumen` |
| D03 | `/clientes*` | C05 | `/mi/listados*` |
| D04 | `POST /compras/simular`, `POST /compras` | C06 | `GET /mi/cuotas` |
| D05 | `GET /compras/:id/cronograma` | C07 | `GET /mi/pagos` |
| | | C08 | `GET /mi/perfil`, `POST /auth/cambiar-contrasena` |
| | | C09 | `GET /mi/ayuda/ejemplo`; el resto es estático |

## 2. Módulos y archivos

Se crea todo salvo lo marcado **(mod)**. Cada módulo de Nest tiene `*.module.ts`, `*.controller.ts`, `*.service.ts` y `dto/`; la tabla solo lista lo particular.

| Ruta en `apps/api/` | Responsabilidad |
|---|---|
| `prisma/schema.prisma` | Resultado de `prisma db pull`. Los scripts de `db/` mandan; nunca se migra (fases 1-2, sección 2) |
| `src/main.ts` **(mod)** | Valida configuración antes de crear la app; `ValidationPipe` global; Swagger solo fuera de producción; CORS por lista |
| `src/app.module.ts` **(mod)**, `src/salud.controller.ts` **(mod)** | Registro de módulos. Salud usa el reloj e informa `relojFijo: true/false` |
| `src/config/configuracion.ts` | `cargarConfiguracion(env)`: función pura que falla con todos los problemas juntos |
| `src/reloj/reloj.ts` | Token `RELOJ`, `RelojSistema`, `RelojFijo` |
| `src/bd/prisma.service.ts` | Cliente Prisma único. Solo se importa dentro de `src/bd/` |
| `src/bd/ambito-tienda.ts` | Extensión de Prisma que inyecta la tienda; clasificación de modelos |
| `src/bd/bd.service.ts` | `enTienda`, `transaccionEnTienda`, `global`, reintento por interbloqueo |
| `src/bd/bloqueos.ts` | Únicas consultas crudas: `UPDLOCK` de tienda, cliente y listado |
| `src/bd/conversiones.ts` | Fechas sin zona y decimales (sección 3.3) |
| `src/bd/errores-bd.ts` | Traduce P2002, 50002, 50003 y demás a `ErrorNegocio` |
| `src/comun/` | `ErrorNegocio`, filtro global, `aSoles`, `aTasa`, `ParseIdPipe`, decoradores `@Publico`, `@Roles`, `@Contexto` |
| `src/auth/` | Login, guardias, `contexto.ts`, `activacion.politica.ts` |
| `src/auditoria/` | `AuditoriaService` (solo inserta), `detalle.ts`, consulta de A05 |
| `src/plataforma/` | Tiendas, usuarios y resumen A02 |
| `src/productos/` | D02 |
| `src/clientes/` | D03, `saldos.ts` (regla de SU, sin Nest), `tasas-cliente.ts` (único punto donde se calculan y validan tasas) |
| `src/compras/` | Simulador, registro, cronograma |
| `src/cortes/` | `CorteService`, programación del cron, ruta manual |
| `src/listados/` | Listados, liquidación, pago |
| `src/negocio/` | Resumen D01 |
| `src/mi/` | Rutas del cliente, con su propio DTO sin `van` ni `monto_contado` |
| `test/unit/`, `test/integracion/`, `test/apoyo/` | Sección 13. `RelojControlable` vive aquí, nunca en `src/` |

Fuera de `apps/api`:

| Ruta | Cambio |
|---|---|
| `packages/finance/src/listado.ts` **(mod)** y `test/juego1.test.ts` **(mod)** | Agrega `itemMora` (sección 10.2) |
| `db/init/02_semillas.sql` **(mod)** | Lote nuevo al final con la fila de alta de la tienda (sección 10.1) |
| `db/init/03_usuario_app.sql` | Login y permisos del usuario de la API (sección 8.3) |
| `db/init/ejecutar.sh` **(mod)** | Pasa `-v APP_DB_PASSWORD="$APP_DB_PASSWORD"` |
| `db/verificar_semillas.sql` **(mod)** | 9 → 10 filas de auditoría y un chequeo nuevo (sección 10.1) |
| `docker-compose.yml` **(mod)** | Sección 4.4 |
| `.env.example` **(mod)** | `APP_DB_PASSWORD`, `NODE_ENV`, `RELOJ_FIJO`, `DATABASE_URL` para desarrollo local |
| `apps/api/Dockerfile` **(mod)** | `package-lock.json` y `npm ci`, `apk add openssl`, `COPY apps/api/prisma`, `prisma generate` antes de compilar |
| `apps/api/package.json` **(mod)** | Sección 3.5 |
| `eslint.config.mjs` **(mod)** | Sección 6.1, punto 3 |
| `package.json` **(mod)** | `test:api`, `test:integracion` |
| `apps/api/test/apoyo/preparar-bd.mjs` | Levanta la BD desechable de pruebas (sección 13.1) |

## 3. Acceso a datos

### 3.1 Evaluación

| Criterio | Prisma 6 con su motor propio | Prisma 7 con `@prisma/adapter-mssql` | `mssql` (tedious) con SQL propio |
|---|---|---|---|
| Stack del prompt (sección 7) | Sí | Sí | No: cambiarlo es escalamiento según `CLAUDE.md` |
| DECIMAL(18,15) sin `number` | Devuelve `Prisma.Decimal` | Por confirmar: el adaptador usa tedious | Tedious entrega `number`: exige `CONVERT(VARCHAR)` en cada lectura y `CAST` en cada escritura |
| `OUTPUT` con trigger | `create` probablemente falla; `createMany` debería pasar | Por confirmar | No aplica: el SQL es propio |
| TIME | Lo mapea a `DateTime`; la API no lo lee ni lo escribe | Igual | No aplica |
| Consultas con `UPDLOCK` | `$queryRaw` dentro de la transacción | Igual | Natural |
| Filtro automático por tienda | Extensión `$extends` | Igual | Repositorios a mano |

### 3.2 Decisión

**Prisma 6, con versión exacta y sin `^`**, para respetar el stack del prompt y evitar el adaptador basado en tedious. Se valida en el paso 0 antes de escribir módulos.

Si falla el paso 0, según la prueba que falle:

| Prueba que falla | Alternativa | ¿Hay que avisar? |
|---|---|---|
| `createMany` en tablas con trigger (S5, S7) | `$executeRaw` parametrizado, solo en `bd/`. No se quitan triggers (fases 1-2, 9.1.3) | No |
| Extensión dentro de una transacción (S8) | Repositorios explícitos construidos con `tiendaId`; las pruebas por HTTP no cambian | No |
| Decimales o fechas sin arreglo posible (S2, S3) | `mssql` con SQL propio: leer con `CONVERT(VARCHAR(40), col)`, escribir con parámetro de texto y `CAST(@x AS DECIMAL(p,s))`. Sin `sql.Decimal`, porque recibe `number` | **Sí.** Es cambio de stack: se detiene y se escala a Adrián con el resultado de la prueba |

### 3.3 Conversiones (`bd/conversiones.ts`)

`fecha_hora` guarda hora local de Lima y Prisma la trata como UTC (fases 1-2, 9.1.1). La regla es que ningún servicio toque un `Date` de la BD.

```ts
export function aInstanteBd(p: PartesLima): Date;              // '2026-08-29', '18:40:00' -> Date con esas partes en UTC
export function dePartesBd(d: Date): PartesLima;               // lee las partes UTC; no resta 5 horas
export function aFechaBd(fecha: string): Date;                 // 'AAAA-MM-DD' a medianoche UTC
export function deFechaBd(d: Date): string;
export function aDecBd(x: Prisma.Decimal | null): Dec | null;  // new Dec(x.toFixed()), nunca toString
export function aDecimalBd(x: Entrada, decimales: number): string; // texto para Prisma
```

`aDecBd` usa `toFixed()` porque `toString()` escribe tasas muy pequeñas en notación científica, y `aDec` del motor rechaza ese texto.

### 3.4 Reglas de uso

- **Montos y tasas:** en memoria son `Dec`; hacia la BD y en JSON son texto. Prohibido `number`, `parseFloat` o `Number()` sobre ellos. Las sumas se hacen en TypeScript con `Dec`, no con `SUM` devuelto como número.
- **`BIGINT`:** Prisma entrega `bigint`, que `JSON.stringify` no admite. En JSON los id son **texto**. `ParseIdPipe` valida `^\d+$`.
- **Tablas con trigger de inserción (`compra_detalle`, `listado_item`):** solo `createMany`. La extensión lanza error si alguien llama a `create`. Ninguna de las dos se actualiza nunca. Los id de sus filas no se necesitan al insertar.
- **`auditoria`:** su trigger es para `UPDATE` y `DELETE`, y la restricción de `OUTPUT` aplica a la acción del trigger, así que `create` debería pasar. Lo confirma S6.
- **`hora_corte`:** la API nunca la escribe (usa el `DEFAULT`) ni la lee. Muestra `HORA_CORTE` del motor (T6: es fija).

### 3.5 Dependencias

Se agregan a `apps/api`: `prisma` y `@prisma/client` (exactas), `@nestjs/jwt`, `@nestjs/schedule`, `@nestjs/throttler`, `class-validator`, `class-transformer`, `bcryptjs`, `helmet`. En desarrollo: `jest`, `ts-jest`, `supertest` y sus tipos.
`bcryptjs` evita compilar módulos nativos en `node:22-alpine`. Los números de versión deben ser compatibles con Nest 10, que es el instalado.

## 4. Configuración, secretos y reloj

### 4.1 `cargarConfiguracion(env)`

Se ejecuta en `main.ts` antes de `NestFactory`. Si hay problemas, los imprime todos y termina con código 1.

**Entorno:** solo `development` y `test` son entornos permisivos. **Si `NODE_ENV` falta o tiene otro valor, se trata como producción.** Así un descuido falla cerrado.

| Variable | En `development` y `test` | En producción |
|---|---|---|
| `JWT_SECRET` | Falta: error. Valor conocido: aviso | Rechaza si falta, si mide menos de 32 caracteres o si está en la lista de valores conocidos (`cambia-este-secreto` y similares) |
| `RELOJ_FIJO` | Opcional; ISO 8601 con desplazamiento, por ejemplo `2026-09-22T12:00:00-05:00` | **Rechaza si tiene valor** |
| `DATABASE_URL` | Obligatoria. **Rechaza `user=sa`** | Igual, y rechaza la contraseña por defecto de `docker-compose.yml` |
| `CORS_ORIGENES` | Por defecto `http://localhost:5173` | Obligatoria si la web no pasa por el nginx |

En desarrollo local, `main.ts` carga `../../.env` con `process.loadEnvFile` si el archivo existe. En Docker no existe y manda `environment`.

### 4.2 Secreto por defecto de docker-compose

Se mantiene `JWT_SECRET: ${JWT_SECRET:-cambia-este-secreto}` para que `docker compose up -d --build` funcione sin `.env`, como pide `CLAUDE.md`. Compose declara `NODE_ENV: ${NODE_ENV:-development}`. Con `NODE_ENV=production` y sin secreto propio, la API no arranca. `.env.example` lo explica.

### 4.3 Reloj inyectable

```ts
export const RELOJ = Symbol('RELOJ');
export interface Reloj { ahora(): Date; readonly fijo: boolean; }
```

- `RelojSistema` devuelve la hora real. `RelojFijo` devuelve siempre `RELOJ_FIJO`.
- `RelojControlable`, con `fijar(iso)`, existe solo en `test/apoyo/` y entra con `overrideProvider(RELOJ)`.

**Protecciones:**

1. `RELOJ_FIJO` con valor impide el arranque en producción (4.1).
2. No existe ninguna ruta que lo cambie. Ningún DTO recibe fecha u hora de una operación (6.1.1: "se toma del servidor"). La excepción por decidir es E1 en la sección 16.
3. ESLint prohíbe `new Date()` sin argumentos y `Date.now()` en `apps/api/src` fuera de `reloj/`.
4. `GET /salud` informa si el reloj es fijo.

**Tokens:** JWT usa la hora real, no el reloj. Así un token no caduca ni se invalida por fijar la fecha de la demo.

**Demo:** para cambiar de fecha se reinicia solo la API, con `RELOJ_FIJO=... docker compose up -d api`.

### 4.4 Cambios en `docker-compose.yml`

| Servicio | Cambio |
|---|---|
| `db` | `ports: '127.0.0.1:${DB_PORT:-1433}:1433'` (fases 1-2, 9.1.9) |
| `db-init` | Agrega `APP_DB_PASSWORD: ${APP_DB_PASSWORD:-VecinoApp#2026}` |
| `api` | `NODE_ENV: ${NODE_ENV:-development}` |
| `api` | `RELOJ_FIJO: ${RELOJ_FIJO-2026-09-22T12:00:00-05:00}`. Con `-` y sin `:`, porque definirla vacía activa la hora real |
| `api` | `DATABASE_URL` con `user=vecinopay_app` y `password=${APP_DB_PASSWORD:-VecinoApp#2026}` |

El valor por defecto de `RELOJ_FIJO` deja la demo en el 22/09/2026, la fecha de D01 y C03. No hace falta `docker compose down -v`: `db-init` crea el login y agrega la fila faltante sobre la BD actual.

## 5. Autenticación y roles

### 5.1 Contraseñas y JWT

- **Hash:** bcrypt de costo 10, igual que las semillas (`$2a$10$`). `bcryptjs` compara cualquiera de los prefijos `$2a$` y `$2b$`. Mínimo 8 caracteres (T7). Prueba: las tres contraseñas de demo del README entran contra los hash sembrados.
- **Usuario inexistente:** igual se ejecuta una comparación contra un hash fijo, para no revelar qué usuarios existen. El mensaje es único: `Usuario, contraseña o perfil incorrectos.`
- **Token:** HS256, 8 horas. Contiene `sub` (id como texto), `perfil` y `tiendaId` (solo para el dueño).
- **Fuerza bruta:** `@nestjs/throttler` en `login` y `activar`, 10 intentos por minuto. La clave incluye el usuario o DNI, porque detrás del nginx todas las peticiones llegan con la misma IP. Además, 60 intentos por minuto por IP, con la IP real que envía el nginx (`docs/decisiones.md`). Se apaga con `overrideGuard` en las pruebas que no lo evalúan.

### 5.2 Guardias globales (por defecto, denegar)

1. `GuardAutenticacion`: verifica el JWT salvo en rutas `@Publico()`. **Lee de la BD en cada petición** el estado del usuario y arma el contexto; el token no basta. Así una baja (RF11) corta el acceso de inmediato.
2. `GuardRoles`: exige `@Roles(...)`. **Una ruta sin `@Publico` ni `@Roles` responde 403.**

```ts
type Contexto =
  | { perfil: 'ADMIN_SISTEMA'; usuarioId: bigint }
  | { perfil: 'DUENO'; usuarioId: bigint; tiendaId: bigint }
  | { perfil: 'CLIENTE'; usuarioId: bigint; tiendaId: bigint; clienteId: bigint };
```

| Perfil | Cómo se obtiene la tienda | Falla (401) si |
|---|---|---|
| `DUENO` | `tienda.id = token.tiendaId` y `duenio_id = sub` | La tienda o el usuario están inactivos o la tienda no es suya |
| `CLIENTE` | `cliente.usuario_id = sub` | Cliente, usuario o tienda inactivos |
| `ADMIN_SISTEMA` | No tiene | Usuario inactivo |

### 5.3 Dueño con varias tiendas

T24 y T34 lo permiten. El login toma la tienda activa de menor id y devuelve `tiendas[]`. `POST /auth/cambiar-tienda` emite otro token tras comprobar que le pertenece. La parte de pantalla queda en E2 (sección 16).

### 5.4 Activación (RF12, C02, 6.1.1)

`POST /auth/activar`, dentro de una transacción:

1. Busca el cliente por `dni` y `codigo_activacion`, con `UPDLOCK`, cliente y tienda `ACTIVO`.
2. Si no hay coincidencia: audita `RECHAZO` y responde 400 `ACTIVACION_INVALIDA`. El mensaje no distingue si falló el DNI o el código.
3. Llama a `activacion.politica.ts` → `resolverUsuario(dni)`. **Es el único punto que cambia si Adrián elige otra opción para "persona en dos tiendas".** Hoy, si ya existe `usuario.username = dni`, responde 409 `DNI_YA_ACTIVADO` con el mensaje `Este DNI ya tiene una cuenta activada en otra tienda. Por ahora cada persona puede activar una sola cuenta.` El código no se consume.
4. Crea `usuario` (perfil `CLIENTE`, `username = dni`, nombre del cliente).
5. En `cliente`: `usuario_id`, `celular`, `codigo_activacion = NULL` (de un solo uso, T7).
6. Audita `ALTA usuario` con el detalle `Cliente activó su cuenta y aceptó el tratamiento de datos personales.` (Ley 29733, decisión de Adrián).

**Código de activación:** tres letras del nombre comercial, guion y cuatro caracteres, con `crypto.randomInt` y un alfabeto sin caracteres confundibles (formato de T7: `MDR-7K2Q`). Se reintenta si choca con `UX_cliente_codigo`.

**Recuperar contraseña (C01):** A04 define el restablecimiento por el administrador (6.2.1). La API no agrega nada más. La pantalla queda en E3 (sección 16).

## 6. Aislamiento multitienda

### 6.1 Mecanismo por capas

1. **El contexto es el único origen de la tienda.** Ningún DTO ni parámetro de dueño o cliente recibe `tiendaId` o, en `/mi`, `clienteId`. `whitelist` y `forbidNonWhitelisted` rechazan el campo si alguien lo envía.

2. **Un cliente de BD que no puede salirse del ámbito.** Los servicios de operación reciben de `BdService.enTienda(tiendaId)` un cliente Prisma extendido. Clasificación en `ambito-tienda.ts`:

   | Clase | Modelos | Lectura, actualización | Creación |
   |---|---|---|---|
   | Directo | `producto`, `cliente`, `compra`, `listado_pago` | Agrega `tienda_id` al `where` | Fija `tienda_id` en los datos |
   | Heredado por FK | `compra_detalle` y `cuota` (por `compra`); `listado_item` y `pago` (por `listado_pago`) | Agrega el filtro por relación (equivale al `JOIN`) | Comprueba antes que el padre sea de la tienda |
   | Global | `usuario`, `tienda`, `auditoria` | Lanza error | Lanza error |

   También lanza error ante `delete`, `deleteMany`, `upsert`, `$queryRaw*` y `$executeRaw*`. **Una prueba recorre `Prisma.dmmf.datamodel.models` y falla si algún modelo no está clasificado.** Esta tabla es el único punto que cambia si Adrián decide agregar `tienda_id` a las tablas heredadas.

3. **ESLint** prohíbe importar `bd/prisma.service` y usar `$queryRaw` o `$executeRaw` fuera de `src/bd/`. `BdService.global()` solo se permite en `auth/`, `auditoria/`, `plataforma/` y `cortes/`, con una lista explícita de carpetas.

4. **La BD** ya impide los cruces con FK compuestas y triggers (`FK_compra_cliente`, 50002, 50003).

5. **Recurso ajeno: 404, no 403.** Así no se revela si el id existe.

**Descartado:** Row-Level Security de SQL Server. Es el filtro más fuerte, pero con conexiones en grupo exige fijar `SESSION_CONTEXT` en cada transacción y predicados con `JOIN` para las 4 tablas heredadas. No cabe en el plazo.

**El administrador** usa solo rutas de `plataforma/` y `auditoria/`. Nunca recibe deudas ni tasas (6.2.1). Sección 8.2 para el detalle de auditoría.

### 6.2 Pruebas (sección 13.4)

Dos tiendas A y B creadas por la API, con el mismo DNI y el mismo código de producto en ambas (T25, T26).

## 7. Transacciones y concurrencia

### 7.1 Reglas comunes

- **Orden de bloqueo fijo:** tienda → cliente → listado. Con eso no hay ciclos entre compra, corte y pago.
- **`UPDLOCK, ROWLOCK`** se mantiene hasta el fin de la transacción. Aislamiento `READ COMMITTED`.
- **La hora se lee después de obtener el bloqueo.** Es lo que hace correcto el corte (7.3).
- **Un rechazo de negocio no lanza excepción dentro de la transacción**, porque eso revertiría la fila de auditoría. La transacción devuelve un resultado, confirma solo el `RECHAZO` y el error HTTP se lanza fuera (T33, 6.4: "sin registrar nada, salvo el intento en la auditoría").
- **Interbloqueo:** `transaccionEnTienda` reintenta hasta 3 veces ante el error 1205 (P2034 de Prisma). Tiempo máximo: 15 s.

### 7.2 Compra (RF05, RF06, Fig. 23)

1. Fuera de la transacción: valida el DTO.
2. Bloquea tienda (por el correlativo) y cliente. El cliente debe estar `ACTIVO`, si no 409.
3. Lee los productos: deben ser de la tienda y `ACTIVO`. `validarModalidad`.
4. `monto_lista = Σ Red(cantidad × precio_lista)` y `monto_contado = Σ Red(cantidad × precio_contado)` (6.1.1, T28). El usuario no digita montos.
5. `ahora = reloj.ahora()`; `fechaOperativaLocal`; `asignarCiclo`.
6. Si existe un `listado_pago` del cliente para esa `fecha_corte`: 409 `CICLO_CERRADO`. Con hora real no puede ocurrir (7.3); protege la demo con reloj fijo.
7. `calcularSu`, `evaluarLimite`. Si se rechaza: audita `RECHAZO` con `registro_id` NULL y responde 422 `LIMITE_EXCEDIDO`.
8. Calcula con el motor, usando la **TED guardada** (T26). `FIN_MES`: los campos de cuotas quedan NULL. `CUOTAS`: `simularVentaEnCuotas`, `tem = cuantizarTasa(tem(ted))`, `tcea = cuantizarTasa(tcea, 10)`, `van`.
9. Inserta `compra`, `compra_detalle` (`createMany`), `cuota` (`createMany`, solo si es `CUOTAS`: fases 1-2, 9.1.8) y auditoría `ALTA compra`.

**Ticket:** `T-` y 6 dígitos. Correlativo por tienda: toma la última compra por `id` dentro del bloqueo de tienda y suma 1. Sobre las semillas, el siguiente es `T-000302`. Una tienda nueva empieza en `T-000001`.

### 7.3 Corte (RF08, 6.3g, 6.3h, Fig. 33)

**Cómo se dispara:**

| Disparador | Cuándo | Condición |
|---|---|---|
| Cron de `@nestjs/schedule` | `1 0 17 * * *`, zona `America/Lima` | Solo con reloj real y fuera de `test` |
| Arranque de la API | Si la hora de Lima ya pasó las 17:00:00 | Igual que el cron. Recupera un corte perdido **solo de hoy** |
| `POST /cortes/ejecutar` (administrador) | A pedido | 409 `CORTE_NO_DISPONIBLE` si la hora es 17:00:00 o menor |

Con reloj fijo no hay cron: dispararía a la hora real con una fecha ficticia. La demo y las pruebas usan la ruta manual.

**Por qué 17:00:01 y no 17:00:00.** La hora de corte es inclusiva con granularidad de segundo (fases 1-2, 6.3): una compra a las `17:00:00.9` todavía es del día. Si el corte corriera a las 17:00:00.0, podría cerrarse antes de ella. A las 17:00:01.0 ya pasó todo el segundo inclusivo. Esto no se contradice con el prompt ("a las 17:00"): el ciclo sigue cerrando a las 17:00:00, y D06 muestra `fecha_corte` con `HORA_CORTE`, no la hora de ejecución.

**Fecha del corte:** `hoy = partesLima(ahora).fecha`, la fecha calendario. **No se usa `fechaOperativa(ahora)`**, que a las 17:00:01 ya daría mañana. No recibe fecha por parámetro y nunca se pone al día (fases 1-2, 9.1.2).

**Pasos:**

1. `listado_pago` con `estado = EMITIDO` y `fecha_pago <= hoy` pasa a `VENCIDO`, con auditoría `CAMBIO` y usuario NULL. Desde las 17:00:01 del día de pago, un pago ya tendría fecha operativa posterior y mora.
2. Enumera las tiendas `ACTIVO` y sus clientes con `dia_corte = día(hoy)`, de cualquier estado: la baja de un cliente no borra su deuda.
3. **Por cada cliente, una transacción propia,** para que un error no detenga a los demás:
   1. Bloquea tienda y cliente.
   2. Si ya existe listado para `(cliente, hoy)`, lo omite. **Esto hace idempotente al corte.**
   3. Reúne los ítems sin listar, usando las fechas guardadas (6.1.3):
      - `compra` con `FIN_MES`, `PENDIENTE` y `fecha_corte = hoy`.
      - `cuota` con `PENDIENTE` y `DATEADD(MONTH, numero, compra.fecha_corte) = hoy`, de compras no anuladas.
      - En ambos casos, `NOT EXISTS` en `listado_item` (fases 1-2, 9.1.7).
   4. Sin ítems no emite listado: María el 20/09 (fases 1-2, 4.6).
   5. `fechaPago`: la `fecha_pago` de las compras o el `fecha_vencimiento` de las cuotas. Si difieren, registra error de ese cliente. No puede ocurrir por la regla de 7.6.
   6. `listadoDePago` con la TED guardada, redondeando compra por compra (Fig. 33).
   7. Número: `EC-AAAAMM-NNNNN`, correlativo por tienda y mes del corte (T30).
   8. Inserta listado e ítems (`createMany`) y audita `ALTA listado_pago` con usuario NULL (decisión ya registrada).

**Por qué no hay doble cobro ni compra perdida.**

| Riesgo | Protección |
|---|---|
| Dos cortes simultáneos | Bloqueo del cliente, comprobación del paso 3.2 y `UQ_listado_cliente_corte` como último recurso |
| Compra en curso que el corte no ve | La compra tiene el bloqueo del cliente: el corte espera y luego la ve |
| Compra que obtiene el bloqueo después del corte | Lee su hora después del bloqueo, ya es mayor que 17:00:00, cae en el día siguiente y en otro ciclo |
| Reloj fijo con la compra después del corte | `CICLO_CERRADO` (7.2, paso 6) |

### 7.4 Pago (RF07, 6.3i, Fig. 35)

1. Bloquea cliente y listado. Si el listado no es de la tienda: 404.
2. Si `estado = PAGADO`: 409 `LISTADO_YA_PAGADO`.
3. `ahora` tras el bloqueo; `partesLima`; `fechaOperativaLocal`.
4. `registrarPago` del motor con los totales del listado, `ted_mora` guardada y `montoPagado`.
5. **Rechazado:** audita `RECHAZO pago` con `registro_id` NULL y el número de listado en `detalle`, igual que el rechazo de compra, y responde 422 `PAGO_NO_EXACTO`, con el mensaje del motor y `totalALaFecha`.
6. **Aceptado,** todo en la misma transacción:
   - `pago`: `fecha` = fecha **calendario** real; `monto`, medio, número de operación e imputación (decisión de Adrián).
   - Si `diasMora > 0`: ítem de mora (sección 10.2).
   - `listado_pago`: `total_mora`, `total`, `estado = PAGADO`, `fecha_pago_real` = fecha calendario, `dias_mora`. Se escriben juntos por `CK_listado_total` y `CK_listado_pagado`.
   - Compras de los ítems `COMPRA` → `PAGADA`. Cuotas de los ítems `CUOTA` → `PAGADA`. Compra en cuotas → `PAGADA` si ya no le queda ninguna pendiente.
   - Auditoría `ALTA pago`, con la hora en `detalle` (decisión de Adrián).

**Doble registro:** el bloqueo y `UQ_pago_listado`. Si aun así salta P2002, se traduce al mismo 409.

### 7.5 Capital pendiente (`clientes/saldos.ts`, decisión de Adrián)

Función pura. **El motor sigue recibiendo SU como dato** (fases 1-2, 9.1.6).

```ts
export interface CompraParaSu {
  modalidad: 'FIN_MES' | 'CUOTAS';
  estado: 'PENDIENTE' | 'PAGADA' | 'ANULADA';
  montoLista: Dec;
  cuotas: { numero: number; estado: 'PENDIENTE' | 'PAGADA'; saldoFinal: Dec }[];
}
export function capitalPendienteCompra(c: CompraParaSu): Dec;
export function calcularSu(compras: CompraParaSu[]): Dec;
```

| Caso | Capital pendiente |
|---|---|
| `ANULADA` o `PAGADA` | 0 |
| `FIN_MES` y `PENDIENTE` | `monto_lista` |
| `CUOTAS` sin la cuota 1 pagada | `monto_lista` |
| `CUOTAS` con la cuota 1 pagada | `saldo_final` de la cuota k más alta tal que 1..k estén todas pagadas |

La última fila precisa "la última cuota pagada" para un caso que Adrián no vio: pagar el listado de la cuota 3 antes que el de la 2. Si se tomara el mayor número pagado, SU daría 0 con la cuota 2 aún debida. En el flujo normal coincide exactamente con lo decidido.

**Valores esperados:** Luis al 22/09: 244.92, disponible 255.08. María: 257.80, tras la cuota 1: 176.96, tras la 2: 90.11, tras la 3: 0.00.

### 7.6 Regla para editar condiciones

`PATCH /clientes/:id` rechaza con 409 `CONDICIONES_CON_DEUDA` un cambio de tasas, moneda, día de corte o día de pago si el cliente tiene SU mayor que cero. `limite_credito` y `max_meses` se pueden cambiar siempre.

Sin esta regla, una tasa cambiada a mitad de ciclo alteraría el interés de compras ya hechas, la mora de un listado emitido (sección 8 del informe: un listado emitido no cambia) o las fechas de las cuotas. Las fechas guardadas en la compra se conservan, como pide 6.1.3. Ningún RF pide editar a mitad de ciclo.

## 8. Auditoría y usuario de BD

### 8.1 Qué se audita (RF01, T33)

`AuditoriaService.registrar(tx, entrada)` se llama **dentro de la misma transacción** que la operación, y siempre con `fecha_hora` del reloj. Si no, los filtros de A02 y A05 no coincidirían con la fecha de la demo.

| Operación | Acción | Tabla |
|---|---|---|
| Login correcto / fallido | `LOGIN` / `RECHAZO` | `usuario` |
| Alta de tienda, producto, cliente, usuario | `ALTA` | La suya |
| Edición, cambio de precio, cambio de clave, reactivación | `CAMBIO` | La suya |
| Baja | `BAJA` | La suya |
| Compra / rechazo por límite | `ALTA` / `RECHAZO` | `compra` |
| Corte y paso a vencido | `ALTA` / `CAMBIO`, usuario NULL | `listado_pago` |
| Pago / rechazo | `ALTA` / `RECHAZO` | `pago` |
| Activación / fallida | `ALTA` / `RECHAZO` | `usuario` / `cliente` |

Un 400 por DTO inválido no se audita: la operación nunca empezó.

**Reactivar se audita como `CAMBIO`, no como `ALTA`.** Si no, el gráfico de altas de A02 contaría dos veces.

### 8.2 Formato de `detalle` y lo que ve el administrador

- **Formato:** texto legible (T33) y, si hace falta, ` | datos=` con JSON (Tabla 1: "registros en JSON"). Ejemplo del alta de cliente: `Alta de cliente Luis Quispe. Aceptó el tratamiento de datos. | datos={"plazoMora":360,"capitalizacionMora":null,"tedMora":"..."}`. Ahí quedan el plazo y la capitalización de mora (decisión de Adrián).
- **Nunca** se escriben contraseñas, hash ni códigos de activación.
- **Conflicto por resolver:** el administrador "no ve montos de deuda ni tasas" (6.2.1, A02), pero A05 muestra un "detalle legible", y las semillas ya traen importes en `detalle`.
- **Regla:** `detalleParaAdmin()` corta desde ` | datos=` y enmascara `S/ n` y `US$ n` como `S/ ***`. `GET /auditoria` la aplica siempre. `GET /plataforma/resumen` ni siquiera incluye `detalle` en sus últimas operaciones.
- **Por comparar:** si la Figura 5 muestra importes en A05, se ajusta esta función, que es el único punto afectado.

### 8.3 Usuario de BD (fases 1-2, 9.1.9)

`db/init/03_usuario_app.sql`, idempotente, se ejecuta con `sa` en cada `up`:

1. **Login en `master`:** si no existe, `CREATE LOGIN vecinopay_app WITH PASSWORD = N'$(APP_DB_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = VecinoPay`. Si existe, `ALTER LOGIN ... WITH PASSWORD`, para que cambiar la variable rote la clave.
2. **Usuario en `VecinoPay`:** `IF NOT EXISTS (sys.database_principals)` → `CREATE USER vecinopay_app FOR LOGIN vecinopay_app`. Sin `db_owner`, `db_ddladmin` ni `db_datawriter`.
3. **Permisos** (`GRANT` y `DENY` se pueden repetir sin error):

| Tablas | Permisos |
|---|---|
| `usuario`, `tienda`, `producto`, `cliente`, `compra`, `cuota`, `listado_pago` | `SELECT, INSERT, UPDATE` |
| `compra_detalle`, `listado_item`, `pago` | `SELECT, INSERT` |
| `auditoria` | `SELECT, INSERT`; `DENY UPDATE, DELETE, ALTER, CONTROL, TAKE OWNERSHIP` |

- Ninguna tabla tiene `DELETE` (baja lógica, 6.1.1).
- `TRUNCATE` exige `ALTER`; el `DENY` y la falta de rol lo impiden. También impide deshabilitar el trigger.
- La BD se publica solo en `127.0.0.1`.
- `db/init/ejecutar.sh` pasa `-v APP_DB_PASSWORD="$APP_DB_PASSWORD"`. El orden alfabético garantiza que corre después de crear las tablas.
- La clave debe cumplir la política de SQL Server y no llevar comillas simples, `;`, `=` ni `{}`, porque también va en `DATABASE_URL`. Si no la cumple, `db-init` falla y la API no arranca, como debe ser.
- `prisma db pull` se ejecuta con `sa` en desarrollo, nunca con el usuario de la API.

## 9. Contratos

### 9.1 Convenciones

- **Prefijo:** `/api`. Autenticación: `Authorization: Bearer`. Todo en Swagger (`/api/docs`).
- **Dinero:** texto con 2 decimales, `"228.42"`. **Tasas:** texto en tanto por uno, `"0.450000000"`. Un `number` en JSON es 400. Las tasas para mostrar llevan además un campo `...Porcentaje`, por ejemplo `tceaPorcentaje: "51.09"`.
- **Fechas:** `AAAA-MM-DD`. **Fecha y hora:** `AAAA-MM-DDTHH:mm:ss`, local de Lima y sin zona. **Id:** texto.
- **Estado:** se devuelve `INACTIVO` tal como está en la BD. La etiqueta "BAJA" de A03 es de la web.
- **Error:** `{ "codigo": "LIMITE_EXCEDIDO", "mensaje": "...", "detalles": {} }`. `mensaje` explica la regla y el valor correcto (Tabla 11).
- **Códigos:** 400 entrada inválida o `ErrorFinanciero`; 401 sin sesión; 403 sin rol; 404 no existe o es de otra tienda; 409 conflicto de estado; 422 rechazo de negocio.
- **Listas:** `?pagina=1&tamano=50`, salida `{ items, total }`.
- **Baja:** `PATCH .../estado { estado }` responde igual para tiendas, usuarios, productos y clientes. `INACTIVO` audita `BAJA`; `ACTIVO` audita `CAMBIO`.

### 9.2 Autenticación

| Ruta | Rol | Entrada | Salida | Errores | RF / pantalla |
|---|---|---|---|---|---|
| `POST /auth/login` | Público | `username, password, perfil` | `token, expiraEn, usuario{id, username, nombres, perfil}, tienda?, tiendas[], cliente?{id, numeroCuenta}` | 401 `CREDENCIALES` | RF01 / A01, C01 |
| `POST /auth/activar` | Público | `dni, codigo, celular, password, passwordConfirmacion, aceptaDatos` (debe ser `true`) | 201 `{ username }` | 400 `ACTIVACION_INVALIDA`, 400 `DATOS_NO_ACEPTADOS`, 409 `DNI_YA_ACTIVADO` | RF12 / C02 |
| `GET /auth/yo` | Todos | | Igual que login, sin `token` | 401 | RF01 / C04 |
| `POST /auth/cambiar-contrasena` | Todos | `actual, nueva` (8 o más) | 204 | 400 `CLAVE_ACTUAL` | RF12 / C08 |
| `POST /auth/cambiar-tienda` | DUENO | `tiendaId` | `token, tienda` | 404 | T24, E2 |

`numeroCuenta`: `cliente.id` con 8 dígitos (decisión de Adrián). C01 envía `perfil: 'CLIENTE'`. A01 solo ofrece los otros dos.

### 9.3 Plataforma (administrador)

| Ruta | Entrada | Salida | Errores | RF / pantalla |
|---|---|---|---|---|
| `GET /plataforma/resumen` | | `tiendasActivas, usuariosActivos, clientesRegistrados, operacionesHoy, altasPorMes[{mes, cantidad}], operacionesPorDia[7]{fecha, cantidad}, tiendasPorGiro[{giro, cantidad}], ultimasOperaciones[]` sin `detalle` | | RF10 / A02 |
| `GET /tiendas` | `texto?, estado?` | `items[{id, ruc, razonSocial, nombreComercial, giro, telefono, direccion, cokTea, estado, duenio{id, username, nombres, estado}}]` | | RF02 / A03 |
| `POST /tiendas` | `ruc, razonSocial, nombreComercial, giro, telefono?, direccion?, cokTea, usuarioDueno, claveTemporal, nombresDueno?` | 201 tienda | 400, 409 `RUC_DUPLICADO`, 409 `USUARIO_NO_ES_DUENO` | RF02 / A03 |
| `PATCH /tiendas/:id` | Los mismos, sin credenciales | Tienda | 404, 409 | RF02 / A03 |
| `PATCH /tiendas/:id/estado` | `estado` | Tienda | 404 | RF02 / A03 |
| `GET /usuarios` | `texto?, perfil?, tiendaId?` | `items[{id, username, nombres, perfil, tienda?, ultimoAcceso?, estado}]` | | RF11 / A04 |
| `POST /usuarios` | `perfil` (`ADMIN_SISTEMA` o `DUENO`), `username, nombres, claveTemporal, tiendaId?` | 201 usuario | 409 `USUARIO_DUPLICADO`, 400 `PERFIL_NO_PERMITIDO` | RF11 / A04 |
| `PATCH /usuarios/:id` | `nombres?, tiendaId?` | Usuario | 404 | RF11 / A04 |
| `POST /usuarios/:id/restablecer-clave` | `claveTemporal` | 204 | 404 | RF11 / A04 |
| `PATCH /usuarios/:id/estado` | `estado` | Usuario | 404, 409 `AUTOBAJA` | RF11 / A04 |
| `GET /auditoria` | `desde?, hasta?, tiendaId?, usuarioId?, accion?` | `items[{id, fechaHora, usuario?, tienda?, accion, tabla, registroId?, detalle}]` con `detalleParaAdmin` | 400 | RF01, RF11 / A05 |
| `POST /cortes/ejecutar` | | `{ fecha, listadosEmitidos[{numero, clienteId, total}], omitidos, vencidos, errores[] }` | 409 `CORTE_NO_DISPONIBLE` | RF08. Sin pantalla: demo y pruebas |

- **`POST /tiendas`:** en una transacción crea o reutiliza al dueño, crea la tienda y audita ambos. Si `usuarioDueno` ya existe con perfil `DUENO`, lo reutiliza e ignora la clave (T24).
- **Baja de tienda:** la tienda pasa a `INACTIVO`. El dueño también, si no le quedan otras tiendas activas (A04: "el usuario de la tienda dada de baja aparece como INACTIVO"). Su historial sigue visible (A03).
- **`POST /usuarios` con `CLIENTE`:** responde 400 `PERFIL_NO_PERMITIDO`. Esa cuenta solo nace en C02, para confirmar que quien crea la contraseña es la persona inscrita (6.1.1).
- **`último acceso`:** `MAX(fecha_hora)` de `LOGIN` (decisión de Adrián).
- **Tienda de un usuario:** por `tienda.duenio_id` o `cliente.usuario_id`.

### 9.4 Operación (dueño)

| Ruta | Entrada | Salida | Errores | RF / pantalla |
|---|---|---|---|---|
| `GET /negocio/resumen` | | Sección 9.6 | | RF10 / D01 |
| `GET /productos` | `texto?, estado?, modalidad?` | Productos | | RF03 / D02, D04 |
| `POST /productos` | `codigo, nombre, marca?, descripcion?, unidad, proveedor?, imagenUrl?, precioContado, precioLista, permiteFinMes, permiteCuotas` | 201 producto | 400 `PRECIO_LISTA`, `PRECIO_CONTADO`; 409 `CODIGO_DUPLICADO` | RF03 / D02 |
| `PATCH /productos/:id` | Los mismos, parciales. Sin `tiendaId` (fases 1-2, 9.1.8) | Producto | 404, 400 | RF03 / D02 |
| `PATCH /productos/:id/estado` | `estado` | Producto | 404 | RF03 / D02 |
| `GET /clientes` | `texto?, estado?` | `items[{..., su, disponible, usoPorcentaje}]` | | RF04 / D03, D04 |
| `POST /clientes/calcular-tasas` | `tasa{tipo, valor, plazo, capitalizacion?}` | `ted, tem, tea` | 400 `TASA_*` | RF04 / D03 |
| `POST /clientes` | DTO de 9.4.1 | 201 cliente con `codigoActivacion` | 400; 409 `DNI_DUPLICADO` | RF04, RF12 / D03 |
| `GET /clientes/:id` | | Cliente con `su, disponible, deudaALaFecha` y código si sigue pendiente | 404 | RF04 / D03, D04 |
| `PATCH /clientes/:id` | Campos del DTO, parciales | Cliente | 404, 400, 409 `CONDICIONES_CON_DEUDA` | RF04 / D03 |
| `PATCH /clientes/:id/estado` | `estado` | Cliente | 404 | RF04 / D03 |
| `POST /compras/simular` | DTO de 9.4.2 | Sección 9.4.3. No guarda ni audita | 400, 404 | RF05, RF06, RF09 / D04 |
| `POST /compras` | DTO de 9.4.2 | 201 compra con sus cuotas | 400 `MODALIDAD`, `CUOTAS_RANGO`, `TIR_SIN_RAIZ`; 404; 409 `CLIENTE_INACTIVO`, `PRODUCTO_INACTIVO`, `CICLO_CERRADO`; **422 `LIMITE_EXCEDIDO`** | RF05, RF06, RF09 / D04 |
| `GET /compras` | `clienteId?, estado?, modalidad?` | Compras | | D04, D05 |
| `GET /compras/:id` | | Compra con detalle | 404 | D04, D05 |
| `GET /compras/:id/cronograma` | | Sección 9.4.4 | 404, 409 `NO_ES_CUOTAS` | RF05, RF09 / D05 |
| `GET /listados` | `clienteId?, estado?, fechaCorte?` | Listados con `estadoEfectivo` | | RF08 / D06, D07 |
| `GET /listados/:id` | | Sección 9.4.5 | 404 | RF08 / D06 |
| `GET /listados/:id/valor-hoy` | `fecha?` (por defecto hoy, no posterior a la fecha de pago) | `td, te, d, descuento, neto` | 404, 400 | 6.3l, T17 / D06 |
| `GET /listados/:id/liquidacion` | | `fechaOperativaPago, diasMora, mora, totalALaFecha, imputacion{mora, interes, capital}, disponibleDespues` | 404, 409 | RF07 / D07 |
| `POST /listados/:id/pago` | `montoPagado, medioPago, numeroOperacion?` | 201 `{ pago, imputacion, listado, disponible }` | 404; 409 `LISTADO_YA_PAGADO`; **422 `PAGO_NO_EXACTO`** | RF07 / D07 |

`estadoEfectivo`: `VENCIDO` si no está pagado y `fecha_pago` es anterior a la fecha operativa actual. Se calcula al leer, porque con reloj fijo el trabajo diario no corre.

#### 9.4.1 `CrearClienteDto` (T6, T7, T26)

```ts
{
  dni: string; nombres: string; apellidos: string; celular?: string; direccion?: string;
  aceptaDatos: true;           // 5, Ley 29733: se registra también cuando el dueño lo inscribe
  moneda: 'PEN' | 'USD'; limiteCredito: string; maxMeses: number; diaCorte: number; diaPago: number;
  tasa: { tipo: 'EFECTIVA' | 'NOMINAL'; valor: string; plazo: number; capitalizacion?: number };
  tasaMora: { tipo: 'EFECTIVA' | 'NOMINAL'; valor: string; plazo: number; capitalizacion?: number };
}
```

- **Validación:** reutiliza `validarTasa`, `validarDiasCiclo`, `validarMaxMeses` del motor.
- **Nominal sin capitalización:** guarda `capitalizacion = 1`, porque `CK_cliente_capitalizacion` no admite NULL en nominales (6.3c).
- **Compensatoria:** guarda tipo, valor, plazo, capitalización y `ted = cuantizarTasa(tasaEfectivaDiaria(tasa))`.
- **Moratoria:** guarda tipo, valor y `ted_mora`. Plazo y capitalización van solo a `auditoria.detalle` (decisión de Adrián). D03 y C08 muestran la tasa guardada.
- **Valores por defecto de T6** (TEA 45 %, mora TEA 10 %, límite 500, 3 meses, corte 20, pago 26): los pone el formulario en fase 4. La API exige cada dato.
- **Tope de tasas:** ninguno en la API ni en la BD. El aviso está en la ayuda de la web (T12). Si Adrián cambia de opción, el único punto es `clientes/tasas-cliente.ts`.

#### 9.4.2 `CompraDto`

```ts
{
  clienteId: string;
  modalidad: 'FIN_MES' | 'CUOTAS';
  numCuotas?: number;                                // obligatorio con CUOTAS, prohibido con FIN_MES
  items: { productoId: string; cantidad: string }[]; // cantidad con hasta 3 decimales, sin precios
}
```

No hay campo de fecha, hora, ticket ni monto (6.1.1).

#### 9.4.3 Salida del simulador

```ts
{
  montoLista, montoContado, fechaOperativa, fechaCorte, fechaPago,
  limite: { aceptada: boolean; disponible: string; mensaje?: string },
  finMes?: { dias, interes, total },
  cuotas?: { g, capitalCapitalizado, interesGracia, cuotaFija, ultimaCuota, primeraCuota,
             tcea, tceaPorcentaje, van, filas: FilaCronogramaDto[] }
}
```

El simulador devuelve el resultado de `evaluarLimite` como dato: es lo que alimenta la barra de D04. Solo `POST /compras` lo convierte en 422.

#### 9.4.4 Cronograma (D05, T19, T22)

```ts
{
  compra: { id, ticket, cliente, fechaHora, fechaOperativa, fechaPago, montoLista, montoContado },
  resumen: { montoCredito, interesGracia, interesCuotas, interesesTotales, cuotaFija, tcea, tceaPorcentaje, tirDiaria, van },
  filas: [{ numero, vence, diasPeriodo, saldoInicial, interes, amortizacion, monto, saldoFinal, estado }],
  totales: { interes, amortizacion, monto },
  flujoCaja: { filas: [{ momento, t, flujo, valorActual }], sumaValorActual, van, cokVigenteCoincide }
}
```

- `tcea` y `van` son los **guardados** (T27). `tirDiaria` y los valores actuales se recalculan con `indicadoresVenta`.
- `sumaValorActual` es la suma sin redondear redondeada al final: 269.81. La web lo muestra como total y **no suma filas**, que darían 269.80 (fases 1-2, 9.3.5).
- `cokVigenteCoincide` es `false` si el COK cambió después de la venta y el VAN recalculado difiere del guardado. El COK no se guarda en la compra (T24, T27).

#### 9.4.5 Listado (D06, T30, T31)

```ts
{
  id, numero, cliente, fechaCorte, horaCorte: '17:00:00', fechaPago, tasa, estado, estadoEfectivo,
  totalCapital, totalInteres, totalMora, total, fechaPagoReal?, diasMora?,
  items: [{ orden, tipo: 'COMPRA'|'CUOTA'|'MORA', ticket?, cuotaNumero?, fechaHoraRegistro?,
            fecha, posteriorAlCorte, detalle?, dias, capital, interes, mora, total }],
  comprasPosteriores: [{ ticket, fechaHora, fechaOperativa, monto, fechaPago }],
  moraALaFecha?: { diasMora, mora, totalALaFecha }
}
```

- `posteriorAlCorte`: hora de registro mayor que 17:00:00. Es el asterisco de D06 y C05.
- `comprasPosteriores`: compras del cliente registradas el día de corte después de las 17:00:00, para la franja verde.
- `moraALaFecha`: es cálculo de lectura, no un ítem guardado (sección 10.2).

### 9.5 Rutas del cliente (`/mi`, rol `CLIENTE`)

Toman `clienteId` del contexto. No reciben id de cliente. **Nunca devuelven `van`, `monto_contado`, COK ni precio contado** (RF09: el VAN es para la tienda).

| Ruta | Salida | RF / pantalla |
|---|---|---|
| `GET /mi/resumen` | `cliente{nombre, numeroCuenta}, tienda{nombreComercial}, proximoPago{total, capital, interes, fecha, diasRestantes}?, credito{limite, usado, disponible, usoPorcentaje}, comprasPorSemana[], comprasDelCiclo, tasa` | RF10 / C03, C04 |
| `GET /mi/listados` | Listados propios | RF08 / C05 |
| `GET /mi/listados/:id` | Igual que 9.4.5. 404 si no es suyo | RF08 / C05 |
| `GET /mi/cuotas` | `compras[{ticket, cuotaFija, tcea, tceaPorcentaje, proximaCuota, filas[{numero, vence, monto, estado}], explicacion{fechaCompra, fechaPago, g, interesGracia, montoLista, capitalCapitalizado}}]` | RF05, RF09 / C06 |
| `GET /mi/pagos` | `pagos[{fecha, medioPago, numeroOperacion, monto, diasMora, imputacion, listadoNumero}], disponible` | RF07 / C07 |
| `GET /mi/perfil` | Datos y condiciones: tasa compensatoria, tasa moratoria guardada, límite, máximo de cuotas, días, hora fija, moneda | RF04 / C08 |
| `GET /mi/ayuda/ejemplo` | Compra más antigua del cliente: `capital, ted, dias, factor, interes, total`. Para Luis es la del 22/08 | RF13 / C09 |

### 9.6 `GET /negocio/resumen` (D01, 6.1.2, 6.3m)

**Se calcula por moneda:** los montos de PEN y USD no se suman (6.1.1, Moneda). Salida: `porMoneda: { PEN: {...}, USD?: {...} }`, además de `fecha` y los datos sin importes.

| Campo | Definición | Al 22/09/2026 |
|---|---|---|
| `capitalPorCobrar` | Σ SU de sus clientes (6.3m) | 502.72 |
| `cobroProximo` | `{fecha, total}` de la menor `fecha_pago` no anterior a la fecha operativa actual, entre listados no pagados | 26/09, 228.42 |
| `interesesDelCiclo` | Σ `total_interes` de los listados con la `fecha_corte` más reciente hasta hoy | 4.80 |
| `carteraEnMora` | Σ `total` de los listados con `estadoEfectivo = VENCIDO` | 0.00 |
| `vanAcumulado` | Σ `van` de compras no anuladas (T27) | 20.01 |
| `ventasPorSemana` | Σ `monto_lista` por semana ISO | Por comparar con la Figura 6 |
| `ventasPorModalidad` | Σ `monto_lista` por modalidad | Por comparar |
| `cobrosPorFecha` | Listados no pagados, más compras sin listar con interés proyectado, más cuotas sin listar, por fecha de pago | 26/09: 228.42. El resto, abajo |
| `usoLimite` | `{cliente, su, limite, usoPorcentaje}` | Luis 49.0, María 43.0 |
| `productosMasVendidos` | Σ cantidad y subtotal, de mayor a menor | Por comparar |

`cobrosPorFecha` al 22/09, calculado a mano, no del informe: 26/10 = 115.33 (21.30 + 0.78 + 93.25); 26/11 = 93.25; 26/12 = 93.26. La prueba debe tomar el 0.78 del motor.

## 10. Observaciones del auditor

### 10.1 Tiendas dadas de alta por mes (A02)

T24 no tiene fecha de alta y el esquema no cambia. **Origen:** `auditoria` con `accion = 'ALTA'` y `tabla = 'tienda'`, agrupada por `AAAA-MM` de `fecha_hora`, contando `DISTINCT registro_id`. `POST /tiendas` crea esa fila.

**Sí se siembra,** o A02 quedaría vacío para Doña Rosa. Ajustes:

| Archivo | Cambio |
|---|---|
| `db/init/02_semillas.sql` | **Lote nuevo después del último `GO`**, idempotente: si existe la tienda y no existe su fila, inserta `(admin, tienda, '2026-08-01T09:00:00', 'ALTA', 'tienda', id, N'Alta de la tienda Minimarket Doña Rosa')`. La fecha lleva `FICTICIO (demo)`; solo debe ser anterior a T-000231. La cabecera aclara esta excepción |
| `db/verificar_semillas.sql:27` | `filas auditoria`: de 9 a **10** |
| `db/verificar_semillas.sql` | Chequeo nuevo: `auditoría ALTA de la tienda` = 1. Los demás no cambian: esta fila tiene usuario, así que `ALTA sin usuario` sigue en 1 |
| `docs/diseno/fases-1-2.md` | Línea 226 ("9 filas") y línea 491 (`auditoria` 9) pasan a 10; agregar la fila a la tabla de 4.7 |

Va en un lote aparte porque el primero termina con `RETURN` si la tienda ya existe. Así funciona sobre una BD nueva y sobre la actual, **sin `docker compose down -v`**, que borraría datos. `semillas.test.ts` no se afecta: busca literales y filas que este lote no toca.

### 10.2 Ítem de mora (RF08)

**Por qué no está en `listadoDePago`:** el corte no conoce la mora. La Fig. 33 no la calcula y la Fig. 35 sí. 6.3i dice que "se agrega" si el cliente paga tarde. Por eso `ItemListado` sigue con `COMPRA | CUOTA` y no se altera esa función ni sus pruebas.

**Cambio en `packages/finance/src/listado.ts`** (motor puro, sin BD):

```ts
export interface ItemMoraListado {
  orden: number; tipo: 'MORA'; fecha: string; dias: number;
  capital: Dec; interes: Dec; mora: Dec; total: Dec;
}
/** 6.3i, T31: capital e interés en cero; total = mora. Lanza ErrorFinanciero si diasMora <= 0. */
export function itemMora(a: {
  ultimoOrden: number; fechaOperativaPago: string; diasMora: number; mora: Entrada;
}): ItemMoraListado;
```

**Cuándo se crea:** solo en el pago aceptado con `diasMora > 0`, en su misma transacción (7.4). Un pago rechazado o un listado solo vencido no crea nada: antes de pagar, la mora cambia cada día y sale como `moraALaFecha`.

**Valores de la fila** (T31, `CK_item_por_tipo`):

| Columna | Valor |
|---|---|
| `compra_id`, `cuota_id` | NULL |
| `orden` | El mayor del listado más 1: siempre al final |
| `tipo` | `MORA` |
| `fecha` | Fecha **operativa** del pago. Junto con `pago.fecha`, que es la calendario, permite reconstruir el caso de las 17:30 |
| `dias` | `dias_mora` |
| `capital`, `interes` | 0.00 |
| `mora`, `total` | La mora redondeada |

**Inserción:** `createMany`, por el trigger. `TR_listado_item_mismo_cliente` no la rechaza porque su `JOIN` a `compra` no encuentra fila. Lo confirma S7.

**Esperado (T17):** el pago del 26/09 a las 17:30 crea orden 6, fecha 27/09, 1 día, 0.06; el listado queda con `total_mora` 0.06 y `total` 228.48. El del 01/10 crea 5 días, 0.30, total 228.72. Si la mora se redondea a 0.00 con días mayores que cero, la fila igual se crea: `dias_mora` ya los registra y ambos deben coincidir.

### 10.3 Desajustes en `docs/diseno/fases-1-2.md` (los corrige la sesión principal)

| Línea | Dice | Realidad | Corrección |
|---|---|---|---|
| 477 | `db/verificar.sh` usa `-S db -d VecinoPay -C -b -I -f 65001` | `db/verificar.sh:4` usa `-S db -U sa -P "$MSSQL_SA_PASSWORD" -C -b -I -f 65001 -i /db/verificar_semillas.sql`, sin `-d`. La BD se elige con `USE VecinoPay` en `db/verificar_semillas.sql:4` | Copiar las opciones reales |
| 535 | "Este diseño no se ejecutó. Hay que confirmar en el primer arranque" `AT TIME ZONE`, `-f 65001` y el `DEFAULT` | Ya se ejecutó: `docs/decisiones.md` (filas del 2026-11-06) registra 52 chequeos y 7 pruebas negativas. `db/verificar_semillas.sql:63-64` prueba los acentos y `:78-83` la hora de Lima | Dejar constancia de lo confirmado y conservar la frase sobre los montos recalculados a mano |

Consecuencia del punto 10.1: líneas 226 y 491.

## 11. Fases 1-2, sección 9.1: estado de cada punto

| # | Tema | Resolución | Dónde |
|---|---|---|---|
| 1 | Hora de Prisma | `conversiones.ts`; ningún servicio toca un `Date` de la BD | 3.3, S3 |
| 2 | Fechas de la demo ya pasadas | Reloj fijo por variable; el corte solo procesa hoy | 4.3, 7.3 |
| 3 | Prisma y triggers | `createMany`, la extensión bloquea `create`; se prueba primero | 3.4, S5 |
| 4 | `pago.fecha` | Calendario real, `dias_mora` guardado, hora en auditoría | 7.4 |
| 5 | `tienda_id` heredado | Clasificación "heredado" de la extensión, filtro por relación | 6.1 |
| 6 | SU | `saldos.ts`; el motor lo recibe como dato | 7.5 |
| 7 | Doble cobro | Bloqueo y `NOT EXISTS` en `listado_item` | 7.3 |
| 8 | Cuotas en `FIN_MES`, tienda de un producto | Las cuotas solo nacen con `CUOTAS`. Ningún DTO recibe `tiendaId` | 7.2, 9.4 |
| 9 | Usuario distinto de `sa`, `127.0.0.1`, `JWT_SECRET` | Script 03, compose, `cargarConfiguracion` | 8.3, 4.4, 4.1 |
| 10 | Datos de pantalla sin sembrar (Peluquería Estilo, usuario inactivo, más auditoría, pagos anteriores) | **No aplica en la fase 3.** La API ya puede crearlos. Sembrarlos en `db/init` rompería los conteos de `verificar_semillas.sql`, que valen para el estado de 6.4. Pasa a la fase 6, en un script aparte `db/demo/pantallas.sql` | Fase 6 |
| 11 | `package-lock.json` y `npm ci` | Paso 1. Se prueba con `docker compose build api` | 14 |

## 12. Temas pendientes de Adrián: punto único de cambio

| Tema | Comportamiento actual | Punto donde cambiaría |
|---|---|---|
| Persona en dos tiendas | 409 `DNI_YA_ACTIVADO` | `auth/activacion.politica.ts`. La opción B cambia además `UX_cliente_usuario`, el contexto y C01 a C03 |
| `tienda_id` heredado | La API filtra por relación | Clasificación en `bd/ambito-tienda.ts` |
| Tope de tasas | No existe | `clientes/tasas-cliente.ts` |
| Estado BAJA | Guarda y devuelve `INACTIVO` | Solo `apps/web`, fase 4 |

## 13. Plan de pruebas

### 13.1 Infraestructura

- **Unitarias:** `npm run test:api`. Sin BD ni Docker. `npm test` de la raíz ejecuta también estas.
- **Integración:** `npm run test:integracion`. Contra **SQL Server real**, con Jest en serie (`--runInBand`).
- **BD desechable:** `preparar-bd.mjs` ejecuta `docker compose -p vecinopay_test` con `DB_PORT=14333`, primero `down -v` y luego `up --wait db db-init`, y corre `db/verificar.sh`. El nombre de proyecto aísla el volumen: **nunca toca los datos de desarrollo.**
- **Conexión:** con `vecinopay_app`, no con `sa`. Así las pruebas ejercen los permisos reales.
- **App:** `Test.createTestingModule` con `overrideProvider(RELOJ)` y Supertest por HTTP.
- **Datos:** cada archivo crea su propia tienda por la API con RUC único. Doña Rosa de las semillas se usa solo para lectura, salvo la activación de María, que se consume una vez por corrida.
- **Motor en Jest:** `moduleNameMapper` de `@vecinopay/finance` a `packages/finance/src`, para no exigir compilarlo antes.
- **Comparación:** texto exacto, sin tolerancia. El criterio de 6.4 admite S/ 0.01, pero las fases 1-2 ya pasan al céntimo.

### 13.2 Unitarias

| Archivo | Casos |
|---|---|
| `configuracion.spec` | Sin `NODE_ENV` actúa como producción. Producción rechaza el secreto por defecto, un secreto corto, `RELOJ_FIJO` y la clave por defecto. `user=sa` se rechaza en todo entorno. Informa todos los problemas juntos |
| `reloj.spec` | `RelojFijo` exige desplazamiento y siempre devuelve lo mismo |
| `conversiones.spec` | `18:40:00` local va y vuelve igual; fecha operativa 30/08 para T-000245; tasa pequeña sin notación científica |
| `saldos.spec` | Cada fila de 7.5, incluido el pago fuera de orden; 244.92, 257.80, 176.96, 90.11, 0.00 |
| `detalle.spec` | Quita `datos=`; enmascara S/ y US$; ninguna salida contiene `999.00` ni `276.38` |
| `ambito-tienda.spec` | Todo modelo del `dmmf` está clasificado; global, `delete`, `$queryRaw` y `create` en tablas con trigger lanzan error |
| `packages/finance/test/juego1.test.ts` | `itemMora`: orden 6, 27/09, 1, 0.06; `diasMora = 0` lanza error |

### 13.3 Recorrido de punta a punta (`juegos.e2e.spec.ts`)

Una sola tienda, igual que 6.4: creada por A03, COK 0.20, con el catálogo de fases 1-2, 4.3. Luis y María en orden cronológico. Los tickets son correlativos y **no** coinciden con T-000231 y siguientes: el informe los intercala y salen de otra numeración. Se identifican por orden. Los números del informe se comprueban en 13.5, sobre las semillas.

**Juego 1 (T16, T17):**

| Paso (reloj de Lima) | Llamada | Esperado |
|---|---|---|
| 22/08 09:15 | Compra P001×2.350, P002×1 | 44.20; operativa 22/08; pago 26/09 |
| 29/08 18:40 | P003×2, P004×4 | 32.80; operativa 30/08 |
| 05/09 11:05 | P002×1, P001×1.530, P003×1, P005×1 | 63.82 |
| 12/09 19:30 | P005×1, P004×3, P006×1 | 30.50; operativa 13/09 |
| 18/09 08:50 | P002×1, P001×2.250, P006×1, P007×1 | 52.30 |
| 19/09 10:00 | **Compra P003×99.900 = 999.00** | **422 `LIMITE_EXCEDIDO`; mensaje con `276.38`; misma cantidad de compras; un `RECHAZO` nuevo** |
| 20/09 17:00:00 | `POST /cortes/ejecutar` | 409 `CORTE_NO_DISPONIBLE` |
| 20/09 17:00:01 | `POST /cortes/ejecutar` | Listado 223.62, 4.80, 228.42; 5 ítems ordenados; días 35, 27, 21, 13, 8; intereses 1.63, 0.93, 1.40, 0.41, 0.43; totales 45.83, 33.73, 65.22, 30.91, 52.73 |
| Igual | `POST /cortes/ejecutar` otra vez | Sin listados nuevos ni auditoría nueva |
| 20/09 17:45 | Compra P001×1.300, P004×3 | 21.30; operativa 21/09; corte 20/10; pago 26/10; no aparece en ítems, sí en `comprasPosteriores` |
| 22/09 | `GET /negocio/resumen` | Sección 13.5 |
| | `GET /listados/:id/valor-hoy?fecha=2026-09-16` | `td` 10; d 1.0268129 %; descuento 2.35; neto 226.07 |

**Escenarios de pago.** Como un listado solo se paga una vez, cada escenario usa un cliente con el mismo ciclo, armado por un ayudante:

| Reloj | Monto | Esperado |
|---|---|---|
| 26/09 17:00:00 | 228.42 | Mora 0; imputación 0.00, 4.80, 223.62; sin ítem de mora; `dias_mora` 0 |
| 26/09 17:00:00.900 | 228.42 | Igual: granularidad de segundo |
| 26/09 17:30 | 228.48 | Mora 0.06, `dm` 1; `pago.fecha` 26/09; ítem de mora con fecha 27/09; hora en auditoría |
| 01/10 | **200.00** | **422 `PAGO_NO_EXACTO`; mensaje con `228.72`; sin fila en `pago`** |
| 01/10 | 228.73 | 422 (Fig. 35 rechaza también el mayor) |
| 01/10 | 228.72 | Mora 0.30, `dm` 5; imputación 0.30, 4.80, 223.62; ítem de mora; compras `PAGADA` |
| Después del anterior | `GET /clientes/:id` | **Disponible 478.70** |
| Otra vez | 228.72 | 409 `LISTADO_YA_PAGADO` |

**Juego 2 (T18 a T20, T22), María:**

| Paso | Llamada | Esperado |
|---|---|---|
| Alta | `POST /clientes`, TNA 0.42, p 360, c 30; mora TEA 0.12 | TED guardada `0.001147371952051` (igual a la semilla) y `calcular-tasas` da TEM 3.5000000 % y TEA 51.1068657 % |
| 15/09 10:35 | `POST /compras/simular`, P012×1, P013×1, 3 cuotas | `g` 11; P' 261.07; R 93.25; última 93.26; TCEA 51.09; VAN 20.01; no guarda nada |
| Igual | `POST /compras` | 257.80 y 249.80; cuotas de la T19 al céntimo |
| | `GET /compras/:id/cronograma` | Días 30, 31, 30; totales 18.69, 261.07, 279.76; intereses 21.96; TIR 0.0011469966; VA 91.33, 89.91, 88.56; `sumaValorActual` 269.81; VAN 20.01 |
| 20/09 17:00:01 | Corte | María sin listado |
| 20/10 17:00:01 | Corte | Listado con CUOTA 1: capital 84.11, interés 9.14, total 93.25, días 30 |
| 26/10 | Paga 93.25 | Sin mora; SU 176.96; disponible 423.04 |
| 20/11 17:00:01 | Corte | CUOTA 2: 86.85, 6.40, 93.25, días 31 |
| 30/11 | Paga 93.37 | **Mora 0.12; `dm` 4; imputación 0.12, 6.40, 86.85**; SU 90.11 |
| 20/12 17:00:01 | Corte | CUOTA 3: 90.11, 3.15, 93.26 |
| 26/12 | Paga 93.26 | SU 0.00; disponible 600.00; compra `PAGADA` |

### 13.4 Aislamiento (`aislamiento.e2e.spec.ts`)

- **Matriz por datos:** cada ruta con `:id` de dueño, con ids de la tienda A y token de B: siempre 404, y la BD no cambia.
- **Meta-prueba:** con `DiscoveryService` se listan las rutas reales. **Falla si una ruta con parámetro no está en la matriz**, si una no tiene `@Publico` ni `@Roles`, o si una mutación no está en la matriz de auditoría de 13.6.
- **Listas:** `GET /productos`, `/clientes`, `/compras`, `/listados` de B no contienen nada de A.
- **Entradas cruzadas:** compra de B con cliente de A → 404; con producto de A → 404; `tiendaId` en el cuerpo → 400.
- **Independencia:** mismo DNI y mismo código de producto en A y B; tickets correlativos propios.
- **Cliente:** Luis pide un listado de María en `/mi/listados/:id` → 404; las rutas de dueño → 403.
- **Campos ocultos:** el JSON de `/mi/*` no contiene `van`, `montoContado`, `cokTea`, `precioContado`.
- **Administrador:** `GET /plataforma/resumen` no contiene importes ni tasas; `GET /auditoria` tampoco; las rutas de dueño → 403.
- **Baja:** dar de baja la tienda B: su token siguiente → 401; `GET /tiendas` sigue listándola.
- **Corte:** corre sobre A y B y cada listado queda en su tienda.

### 13.5 Estado sembrado (`semillas.e2e.spec.ts`, reloj 22/09/2026)

| Llamada | Esperado |
|---|---|
| Login | Las 3 contraseñas de demo contra los hash sembrados |
| Rosa: `GET /negocio/resumen` | 502.72; 26/09 y 228.42; 4.80; 0.00; 20.01; uso 49.0 y 43.0 |
| Rosa: `GET /listados/:id` | `EC-202609-00001`, T-000231 a T-000290, marca `posteriorAlCorte` en T-000245 y T-000278; T-000301 en `comprasPosteriores` |
| Luis: `GET /mi/resumen` | 228.42 el 26/09, 4 días, disponible 255.08 de 500.00, 5 compras |
| Admin: `GET /plataforma/resumen` | `altasPorMes` con `2026-08: 1`; `tiendasPorGiro` con Minimarket |
| María: `POST /auth/activar` con `MDR-7K2Q` | 201; repetirlo → 400; la auditoría registra la aceptación |
| María: `GET /mi/cuotas` | 93.25, 51.09, 26/10, explicación con 11 días y 3.27 |
| Luis: `GET /mi/ayuda/ejemplo` | 44.20, 35 días, 1.63 |
| Cliente nuevo con DNI 45872316 en otra tienda, al activar | 409 `DNI_YA_ACTIVADO`; el código no se consume |

### 13.6 Concurrencia, auditoría y permisos

| Archivo | Caso | Esperado |
|---|---|---|
| `concurrencia.e2e` | 2 pagos simultáneos del mismo listado | Uno 201 y otro 409; 1 fila en `pago` |
| | 2 compras simultáneas, límite 100, 60 cada una | Una 201 y otra 422 |
| | 2 cortes simultáneos | 1 listado por cliente; sin ítems duplicados |
| | 20 compras simultáneas en una tienda | Tickets sin repetir ni saltos |
| | Compra a las 17:00:00 del día de corte y luego corte | La compra está en el listado |
| | Compra a las 17:00:01 del día de corte | Pasa al ciclo siguiente |
| `auditoria.e2e` | Matriz: cada mutación y cada rechazo de 8.1 | Una fila con la acción y tabla esperadas, `fecha_hora` del reloj, usuario y tienda |
| | Revisión de texto de `detalle` en toda la corrida | No contiene contraseñas, `$2a$` ni códigos |
| `permisos.e2e` (con `vecinopay_app`) | `TRUNCATE dbo.auditoria` | Falla por permisos (error 1088) y las filas siguen |
| | `DELETE` y `UPDATE` en `auditoria`; `DELETE` en cualquier tabla | Falla (error 229) |
| | `ALTER TABLE`, `DISABLE TRIGGER` | Falla |
| | `sys.triggers` | Los 3 triggers siguen habilitados |

## 14. Plan de implementación

Cada paso termina con la suite en verde y con un commit. Los pasos 0 a 10 son el camino mínimo hacia los juegos 1 y 2. **Si el tiempo se acorta,** se reduce primero el paso 11 (gráficos de D01 y A02: `ventasPorSemana`, `productosMasVendidos`) y los filtros secundarios de A04 y A05, nunca el aislamiento ni la auditoría.

| Paso | Commit | Entregable | Criterio de aceptación |
|---|---|---|---|
| 0 | `fase-3: prisma sobre el esquema y prueba de concepto` | Dependencias, `schema.prisma`, `00-prisma.spec.ts`, `preparar-bd.mjs` | S1 a S10 de abajo. Si fallan S2, S3 o S8: aplicar 3.2 antes de seguir |
| 1 | `fase-3: usuario de bd, compose y fila de alta de tienda` | `03_usuario_app.sql`, `ejecutar.sh`, semillas, verificación, compose, `.env.example`, Dockerfile | `docker compose up -d --build` dos veces sin error sobre la BD actual, sin borrarla. `npm run db:verificar` en verde con 10 filas. `permisos.e2e` en verde. `docker compose build api` con `npm ci` |
| 2 | `fase-3: configuración segura y reloj inyectable` | `config/`, `reloj/`, salud, regla de ESLint | Unitarias en verde. `NODE_ENV=production` con el secreto por defecto termina con código 1. `npm run lint` marca un `new Date()` de prueba |
| 3 | `fase-3: acceso a datos con ámbito de tienda y auditoría` | `bd/`, `comun/`, `auditoria/` sin consulta | Unitarias en verde. Una consulta de prueba en ámbito de A no ve datos de B |
| 4 | `fase-3: login, roles y activación` | `auth/` | Las 3 contraseñas entran. Ruta sin rol → 403. Activación de María y rechazo del DNI repetido. Filas `LOGIN` y `RECHAZO` |
| 5 | `fase-3: tiendas, usuarios, auditoría y resumen de plataforma` | `plataforma/`, consulta de A05 | Crear tienda y dueño, y que el dueño entre. Baja corta el acceso. `altasPorMes` correcto. Sin importes para el administrador |
| 6 | `fase-3: productos y clientes` | `productos/`, `clientes/` incluido `saldos.ts` | Precio inválido → 400. TED igual al literal de la semilla. `CONDICIONES_CON_DEUDA`. Disponible 255.08 sobre las semillas |
| 7 | `fase-3: compras, simulador y cronograma` | `compras/` | Juego 2 hasta la compra con T18 a T20 al céntimo. Compra de 999.00 → 422 con 276.38 |
| 8 | `fase-3: corte de las 17:00 idempotente` | `cortes/` | Listado 228.42. Corte repetido sin cambios. 17:00:00 → 409. Compra de las 17:45 fuera. Concurrencia del corte |
| 9 | `fase-3: ítem de mora en el motor` | `itemMora` y prueba | `npm test` en verde |
| 10 | `fase-3: listados, liquidación y pago con mora` | `listados/` | Todos los escenarios de pago de 13.3. **`juegos.e2e` completo en verde.** Concurrencia del pago |
| 11 | `fase-3: resumen del negocio y rutas del cliente` | `negocio/`, `mi/` | `semillas.e2e` en verde; sin campos ocultos |
| 12 | `fase-3: pruebas de aislamiento y cobertura de rutas` | `aislamiento.e2e`, `auditoria.e2e`, resto de `concurrencia.e2e` | Meta-prueba en verde: toda ruta está en las matrices |
| 13 | `fase-3: swagger y guía de prueba` | Swagger completo; README con los comandos | `/api/docs` lista todas las rutas. El revisor corre las suites; el auditor compara con el informe |

### Paso 0: pruebas de concepto de Prisma

| # | Prueba | Si falla |
|---|---|---|
| S1 | `db pull` genera 11 modelos, con FK compuestas y las columnas de Adrián. Revisar cómo quedan los índices filtrados | Ajuste manual menor del `schema.prisma` |
| S2 | `ted` lee y escribe exactamente `0.001032653810255`; `tcea` `0.5108647287`; un monto `9999999999.99` | **Alternativa `mssql`: escalar** |
| S3 | `2026-08-29T18:40:00` sale igual tras guardar; DATE sin corrimiento de día | **Alternativa `mssql`: escalar** |
| S4 | Crear cliente sin `hora_corte` deja 17:00:00. Leer la columna no falla | Ajustar `dbgenerated` |
| S5 | `create` en `compra_detalle`: registrar el resultado. `createMany`: pasa y sigue disparando 50002 | `$executeRaw` |
| S6 | `create` en `auditoria` pasa | `createMany` |
| S7 | `createMany` de ítem `MORA` pasa el trigger | `$executeRaw` |
| S8 | Transacción interactiva sobre cliente extendido; un `UPDLOCK` hace esperar a otra transacción | Repositorios explícitos |
| S9 | Todo lo anterior con `vecinopay_app` | Revisar `GRANT` |
| S10 | La imagen `node:22-alpine` carga el motor (`binaryTargets` y `openssl`) | Ajustar Dockerfile |

## 15. Riesgos y supuestos

**Sin confirmar porque nada se ejecutó:**

1. **Prisma:** todo el contenido de S1 a S10. En especial, si `createMany` evita `OUTPUT`, si la extensión funciona dentro de `$transaction` y cómo introspecciona los índices filtrados y el `DEFAULT` de `TIME`.
2. **Versiones:** que Prisma 6 siga publicado y admita SQL Server con Node 22, y la compatibilidad exacta de `@nestjs/schedule` y `@nestjs/throttler` con Nest 10. El comportamiento de tedious con DECIMAL y del adaptador de Prisma 7 sale de mi conocimiento, no de una prueba.
3. **SQL Server:** el error 1088 de `TRUNCATE` y el 229 de `DELETE`. La prueba debe mirar que la operación falle y que las filas sigan, además del número exacto.
4. **`sqlcmd -v`** con una clave que lleve `#`.
5. **Compose:** la sintaxis `${RELOJ_FIJO-valor}` y el arranque de `up --wait` con `db-init`, que termina y no queda en ejecución. Si `--wait` lo trata como fallo, `preparar-bd.mjs` espera por su cuenta.
6. **Cifras no publicadas en el informe:** `0.78`, `115.33`, 423.04 y 509.89 son cálculos a mano. Las pruebas deben tomarlas del motor o confirmarlas allí.

**Por comparar con el `.docx`,** porque las figuras no están en el `.txt` (lo hará el auditor si tiene el archivo):

- Figura 5: si A05 muestra importes (8.2).
- Figura 6: etiquetas de semanas, valores de los gráficos de D01 y productos más vendidos.
- Figuras 3, 4 y 12: campos de los formularios de A03, A04 y D07.
- Figura 17: formato del número de cuenta.

**Otros:**

- **Plazo:** el paso 0 debe quedar en medio día. Si no termina, se decide ahí y no más tarde.
- **Rendimiento:** bloquear la tienda serializa las compras de esa tienda. Es aceptable para una tienda de barrio, y no afecta a las demás.
- **Corte perdido de días anteriores:** por la regla de 9.1.2, si la API estuvo apagada todo un día, ese corte no se recupera y sus ítems no se listan. Es limitación conocida, aceptable para el alcance académico; en la demo no ocurre porque el reloj fijo no usa cron.
- **Hora real sobre las semillas:** con `RELOJ_FIJO` vacío, las semillas aparecen vencidas y los cortes de días pasados no se recuperan. Por eso el valor por defecto es el 22/09/2026.
- **Valor de hoy:** la API lo expone, y T8 lo declara como salida, pero 6.2 no describe en qué pantalla aparece. Se recomienda mostrarlo en D06 en la fase 4.
- **Tokens:** cambiar o restablecer la clave no invalida los tokens ya emitidos, porque no hay columna para eso. Duran 8 horas. La baja sí corta el acceso de inmediato.

**Contradicción anotada:** el prompt pide `tienda_id` en toda tabla de operación; las Tablas 28, 29, 31 y 32 no lo tienen. Gana el informe (ya registrado).

## 16. Puntos para escalar a Adrián

Ninguno bloquea el juego 1 ni el juego 2. El diseño avanza con la opción recomendada y cada una está aislada en un solo punto.

### [ESCALAR] E1. ¿Se puede digitar la fecha real del pago en D07?

**Tema:** D07 muestra el campo "fecha real de pago" y T6 lo define con "por defecto: fecha del servidor". Para la compra, 6.1.1 dice que se toma del servidor "para que no pueda alterarse". Para el pago no lo dice. Cambia la mora cobrada (RF07, D07).

- **A:** siempre la hora del servidor; D07 la muestra sin permitir editarla. Un pago en efectivo del sábado registrado el lunes paga la mora del lunes.
- **B:** el dueño puede digitar fecha y hora no posteriores a ahora, y se audita la diferencia. El dueño puede reducir la mora de un cliente.

**Recomendación:** A. Es la lectura de la regla de la compra, impide alterar la mora y coincide con fases 1-2, 9.1.2.
**Bloquea:** solo si ese campo de D07 es editable, en fase 4. **Punto de cambio:** `instanteDelPago()` en `listados/` y un campo en el DTO.

### [ESCALAR] E2. Dueño con más de una tienda

**Tema:** T24 y T34 lo permiten, pero A01 y las pantallas del dueño no tienen dónde elegir la tienda. Agrega un control a una pantalla entregable.

- **A:** selector en la cabecera, visible solo con 2 tiendas o más. Agrega un elemento que no está en los mockups.
- **B:** no ofrecerlo: A03 exige un usuario de dueño nuevo por tienda. Elimina `cambiar-tienda`, pero contradice la explicación de T24 y debe aclararse en el Word.

**Recomendación:** A. La API ya lo soporta y los juegos de prueba no lo tocan.
**Bloquea:** nada en la fase 3; solo ese selector en fase 4.

### [ESCALAR] E3. Enlace "recuperar la contraseña" de C01

**Tema:** C01 tiene el enlace, pero el informe no define qué hace. Solo A04 define el restablecimiento por el administrador.

- **A:** el enlace abre un texto: "Pídele a tu tienda que solicite restablecer tu clave". Sin API nueva.
- **B:** el dueño genera un código nuevo en D03 y el cliente lo usa en C02. Una ruta más, un botón en D03 y cambios en la activación.

**Recomendación:** A, por el plazo.
**Bloquea:** solo ese enlace en fase 5.

### [ESCALAR] E4. Erratas adicionales del Word

**Tema:** la Tabla 1 dice "modelo físico multitienda de **22 tablas**" (línea 443 de `docs/informe_v8.txt`), mientras la sección 8 tiene 11. La misma tabla habla de "registros en JSON" en auditoría; T33 dice "descripción legible" (el diseño cumple ambas en 8.2). No cambia ninguna cifra del sistema, pero corregirlo obliga a tocar el Word.

- **A:** corregir "22" por "11" y sumarlo a la fila de erratas pendiente.
- **B:** dejarlo y explicarlo en la sustentación.

**Recomendación:** A, es una palabra.
**Bloquea:** nada.

**Registrar en `docs/escalaciones.md`:** E1 a E4. Los temas ya pendientes siguen igual (sección 12).

## 17. Decisiones nuevas para `docs/decisiones.md`

| Tema | Decisión | Por qué |
|---|---|---|
| Acceso a datos | Prisma 6 con versión exacta; paso 0 antes de escribir módulos; `mssql` solo con aviso a Adrián | Stack del prompt; el riesgo se descubre el primer día |
| Tablas con trigger | Solo `createMany` en `compra_detalle` y `listado_item` | `OUTPUT` sin `INTO` no se admite con trigger de la misma acción; los triggers se quedan |
| Hora del corte | El cron corre a las 17:00:01 y procesa la fecha calendario de Lima | 17:00:00 es inclusiva con granularidad de segundo (Fig. 25); el ciclo sigue cerrando a las 17:00:00 |
| Hora tras el bloqueo | Compra y pago leen el reloj después del `UPDLOCK` del cliente | Garantiza que una compra no quede fuera de un corte ya ejecutado |
| Selección del corte | Por fechas guardadas: `compra.fecha_corte` y `DATEADD(MONTH, numero, compra.fecha_corte)` | 6.1.3: las fechas se graban para no recalcularlas |
| Corte manual | `POST /cortes/ejecutar` solo para administrador, solo "hoy", solo tras las 17:00:00; sin cron con reloj fijo | Fases 1-2, 9.1.2 |
| Entorno por defecto | `NODE_ENV` ausente equivale a producción | Falla cerrado ante un descuido |
| Editar condiciones | Tasas, moneda y días no cambian con SU mayor que cero | Sección 8 del informe: un listado emitido no cambia; ningún RF pide más |
| SU fuera de orden | `saldo_final` de la mayor k con 1..k pagadas | Precisa la decisión de Adrián en un caso no previsto; el flujo normal no cambia |
| Ítem de mora | `itemMora` en el motor; solo se guarda en el pago aceptado, con la fecha operativa | 6.3i, T31, Fig. 33 y 35 |
| Alta de tienda | La fecha sale de `auditoria`; se siembra en un lote idempotente; 10 filas | Observación del auditor; sin cambiar el esquema ni usar `down -v` |
| Detalle para el administrador | `detalleParaAdmin` quita `datos=` y enmascara importes | 6.2.1 y A02 |
| Reactivación | Se audita como `CAMBIO` | El gráfico de altas de A02 no debe contar dos veces |
| Baja con deuda | Bloquea compras nuevas y acceso; corte y cobro siguen. Con tienda inactiva, el corte se omite | La baja es lógica y no borra la deuda |
| Cuenta de cliente | Solo nace en C02; A04 no la crea | 6.1.1: el código confirma a la persona inscrita |
| Tickets en pruebas | La prueba de punta a punta no reproduce T-000231; las semillas sí | T27 los define como correlativos y el informe los intercala con otra numeración |
| Datos de pantalla sin sembrar | Pasan a la fase 6 en `db/demo/pantallas.sql`, fuera de `db/init` | `verificar_semillas.sql` vale solo para el estado de 6.4 |
| Bases de prueba | Proyecto Docker `vecinopay_test`, puerto 14333 | No se tocan los datos de desarrollo |
| Imagen de producto | URL `.jpg` o `.png` en la fase 3; subida a evaluar en fase 4 | T25 define `imagen_url VARCHAR(300)` |
