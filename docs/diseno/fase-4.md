# Diseño de la fase 4: web del administrador y del dueño

Fuentes, en orden: `docs/informe_v8.txt`, `docs/prompt_desarrollo.md`, `CLAUDE.md`. Si se contradicen, gana el informe.
Los contratos reales salen de `apps/api/src`, no solo de `docs/diseno/fase-3.md`.
Nada de este documento se ejecutó. Las cifras marcadas "a mano" se deben confirmar en pantalla contra la API.
Las Figuras 1 a 13 son imágenes y el `.docx` no está disponible: lo que dependa de ellas se marca "por comparar" (sección 14).

## 1. Resumen

1. **Semillas primero:** un lote nuevo e idempotente agrega 5 tiendas de demostración, 4 dueños, 4 productos y 21 filas de auditoría, sin clientes ni compras. Ninguna cifra de 6.4 cambia.
2. **API:** no se agregan rutas. Solo 3 cambios de salida: datos de la barra de D04, moneda en D05 y todas las tiendas del dueño en A04.
3. **Web:** una sola app con rutas por perfil. Los montos son texto de la API hasta el formateo; la web no suma ni recalcula.
4. **RF08 en D06:** PDF con la impresión del navegador y WhatsApp con un enlace `wa.me`. Sin dependencias ni rutas nuevas.
5. **Demo:** franja visible solo con reloj fijo y botón de corte solo para el administrador, en A02 y solo con reloj fijo.

## 2. Semillas de demostración

### 2.1 Datos exactos

Todo este lote es `FICTICIO (demo)`. Va en `db/init/02_semillas.sql`, después del último `GO`. Los giros salen de las líneas 45 y 664 del informe, salvo Librería, y Peluquería Estilo de A03 (línea 2076).

**Usuarios** (perfil `DUENO`, contraseña `Tienda#2026`, con el mismo literal bcrypt de Rosa, no leído de su fila, porque Rosa podría haber cambiado su clave en una BD ya usada):

| `username` | `nombres` | `estado` |
|---|---|---|
| `elena.demo@vecinopay.test` | Elena Paredes | **INACTIVO** |
| `carlos.demo@vecinopay.test` | Carlos Rojas | ACTIVO |
| `ana.demo@vecinopay.test` | Ana Torres | ACTIVO |
| `jorge.demo@vecinopay.test` | Jorge Salas | ACTIVO |

**Tiendas** (`cok_tea = 0.200000000`, valor por defecto de T6):

| RUC | `nombre_comercial` | `razon_social` | `giro` | Dirección y teléfono | Dueño | Alta | `estado` |
|---|---|---|---|---|---|---|---|
| 20999000001 | Peluquería Estilo | Salón Estilo E.I.R.L. | Peluquería | Jr. Las Tijeras 210, Lima; 014000222 | Elena | 2026-04-08T09:00:00 | **INACTIVO** |
| 20999000002 | Bodega El Vecino | Bodega El Vecino S.A.C. | Bodega | Av. Central 340, Lima; 014000333 | Carlos | 2026-05-12T10:15:00 | ACTIVO |
| 20999000003 | Panadería San Martín | Panificadora San Martín S.A.C. | Panadería | Jr. San Martín 55, Lima; 014000444 | Ana | 2026-06-03T11:00:00 | ACTIVO |
| 20999000004 | Pollería El Buen Sabor | El Buen Sabor E.I.R.L. | Pollería | Av. Los Sauces 780, Lima; 014000555 | Carlos | 2026-07-15T16:20:00 | ACTIVO |
| 20999000005 | Librería El Estudiante | Librería El Estudiante S.A.C. | Librería | Jr. Los Libros 12, Lima; 014000666 | Jorge | 2026-09-03T09:40:00 | ACTIVO |

- Carlos tiene 2 tiendas (T24, T34) para poder probar el selector de la cabecera sin alterar nada de Rosa.
- Los RUC no chocan con `20000000001` y `20000000002`, que `db/verificar_semillas.sql:113` y `:132` insertan y revierten en sus pruebas negativas, ni con los prefijos de las pruebas de API (`10`, `21`, `22`, `30`, `31`, `40`, `50`).
- Agosto queda solo para Doña Rosa, así que `01-semillas.e2e.spec.ts:70` (`2026-08: 1`) sigue siendo cierta. Las altas quedan en 6 meses seguidos, de abril a septiembre.

**Productos** (`permite_fin_mes = 1`, `permite_cuotas = 0`, unidad `UND`):

| Tienda | Código | Nombre | Contado | Lista | Estado |
|---|---|---|---|---|---|
| Panadería San Martín | PAN01 | Pan francés | 0.50 | 0.60 | ACTIVO |
| Panadería San Martín | PAN02 | Keke casero | 12.00 | 13.00 | **INACTIVO** |
| Bodega El Vecino | BOD01 | Gaseosa 1.5 L | 6.00 | 6.50 | ACTIVO |
| Pollería El Buen Sabor | POL01 | Pollo a la brasa, 1/4 | 14.00 | 15.00 | ACTIVO |

**Por qué van productos en tiendas de demostración y no en Doña Rosa.** A05 debe mostrar "un cambio de precio, una baja de producto" (línea 2113). Esas filas necesitan un producto real. Si se pusieran en Doña Rosa, cambiaría su catálogo de 9 productos, que `Prueba.crearTienda` (`apps/api/test/apoyo/app.ts:93`) copia en todas las pruebas. BOD01 y POL01 permiten ver que el selector cambia el catálogo.

**Auditoría, 21 filas nuevas.** Usuario "admin" es `admin@vecinopay.test`. Los textos son los que escribe la API (`plataforma.service.ts`, `productos.ts`, `auth.service.ts`).

| # | `fecha_hora` | Usuario | `tienda_id` | Acción | Tabla | `registro_id` | `detalle` |
|---|---|---|---|---|---|---|---|
| 1 | 2026-04-08T09:00:00 | admin | NULL | ALTA | usuario | Elena | Alta del usuario elena.demo@vecinopay.test. |
| 2 | 2026-04-08T09:00:00 | admin | Peluquería | ALTA | tienda | Peluquería | Alta de la tienda Peluquería Estilo. |
| 3 | 2026-05-12T10:15:00 | admin | NULL | ALTA | usuario | Carlos | Alta del usuario carlos.demo@vecinopay.test. |
| 4 | 2026-05-12T10:15:00 | admin | Bodega | ALTA | tienda | Bodega | Alta de la tienda Bodega El Vecino. |
| 5 | 2026-06-03T11:00:00 | admin | NULL | ALTA | usuario | Ana | Alta del usuario ana.demo@vecinopay.test. |
| 6 | 2026-06-03T11:00:00 | admin | Panadería | ALTA | tienda | Panadería | Alta de la tienda Panadería San Martín. |
| 7 | 2026-07-15T16:20:00 | admin | Pollería | ALTA | tienda | Pollería | Alta de la tienda Pollería El Buen Sabor. |
| 8 | 2026-09-03T09:40:00 | admin | NULL | ALTA | usuario | Jorge | Alta del usuario jorge.demo@vecinopay.test. |
| 9 | 2026-09-03T09:40:00 | admin | Librería | ALTA | tienda | Librería | Alta de la tienda Librería El Estudiante. |
| 10 | 2026-09-10T18:00:00 | Elena | Peluquería | LOGIN | usuario | Elena | Inicio de sesión como DUENO. |
| 11 | 2026-09-16T08:30:00 | Ana | Panadería | CAMBIO | producto | PAN01 | Cambio de precio del producto PAN01: lista de S/ 0.50 a S/ 0.60. |
| 12 | 2026-09-16T08:35:00 | Ana | Panadería | BAJA | producto | PAN02 | Baja del producto PAN02. |
| 13 | 2026-09-17T10:30:00 | admin | Peluquería | BAJA | usuario | Elena | Baja del usuario elena.demo@vecinopay.test: se quedó sin tiendas activas. |
| 14 | 2026-09-17T10:30:00 | admin | Peluquería | BAJA | tienda | Peluquería | Baja de la tienda Peluquería Estilo. |
| 15 | 2026-09-21T08:55:00 | admin | NULL | LOGIN | usuario | admin | Inicio de sesión como ADMIN_SISTEMA. |
| 16 | 2026-09-21T09:05:00 | Rosa | Doña Rosa | LOGIN | usuario | Rosa | Inicio de sesión como DUENO. |
| 17 | 2026-09-21T19:10:00 | Luis | Doña Rosa | LOGIN | usuario | Luis | Inicio de sesión como CLIENTE. |
| 18 | 2026-09-22T08:00:00 | Ana | Panadería | LOGIN | usuario | Ana | Inicio de sesión como DUENO. |
| 19 | 2026-09-22T08:20:00 | Carlos | Bodega | LOGIN | usuario | Carlos | Inicio de sesión como DUENO. |
| 20 | 2026-09-22T09:00:00 | Rosa | Doña Rosa | LOGIN | usuario | Rosa | Inicio de sesión como DUENO. |
| 21 | 2026-09-22T09:30:00 | Jorge | Librería | LOGIN | usuario | Jorge | Inicio de sesión como DUENO. |

Todas las fechas son iguales o anteriores al 22/09/2026, y la fila 11 queda enmascarada para el administrador por `detalleParaAdmin` (`S/ *** a S/ ***`).

**Estado del dueño de Peluquería Estilo:** INACTIVO. Lo dice A04 (línea 2096) y es lo que hace `estadoTienda` cuando el dueño se queda sin tiendas activas. A03 muestra la etiqueta "BAJA"; A04 muestra "INACTIVO" (decisión de Adrián).

### 2.2 Lote idempotente

```
GO
-- Tiendas de demostración para A02 a A05. No traen clientes ni compras.
SET NOCOUNT ON; SET XACT_ABORT ON;
IF EXISTS (SELECT 1 FROM dbo.tienda WHERE ruc = '20999000001') → PRINT y RETURN
BEGIN TRANSACTION
  usuarios → tiendas → productos → auditoría
COMMIT
GO
```

- **Lote aparte:** el primero termina con `RETURN` si Doña Rosa existe y `RETURN` solo termina su lote. Así llega a una BD nueva y a la actual, sin `docker compose down -v`.
- **Un solo centinela:** todo el lote va en una transacción, de modo que no puede quedar a medias.
- **Busca por `username` y `ruc`,** nunca por id fijo.
- **Cabecera del archivo:** las líneas 1 y 2 deben aclarar esta segunda excepción, igual que la del alta de Doña Rosa.
- **Sin `DECLARE @ted_*` ni `@tienda, @luis`:** `semillas.test.ts` busca esos patrones en todo el archivo.

### 2.3 Cómo cambia `db/verificar_semillas.sql`

**Conteos:**

| Línea | Chequeo | Hoy | Cambio |
|---|---|---|---|
| 17 | `filas usuario` | 3 | **7** |
| 18 | `filas tienda` | 1 | **6** |
| 19 | `filas producto` | 9 | **13** |
| 27 | `filas auditoria` | 10 | **31** |
| 20 a 26 | `cliente`, `compra`, `compra_detalle`, `cuota`, `listado_pago`, `listado_item`, `pago` | 2, 7, 19, 3, 1, 5, 0 | **Sin cambio y sin filtro.** Si siguen globales, además prueban que el lote nuevo no agregó nada de operación |

**Filtrar por Doña Rosa** (el valor esperado no cambia):

| Línea | Chequeo | Filtro nuevo |
|---|---|---|
| 31 | `capital por cobrar` (502.72) | `tienda_id = @tienda` |
| 38, 39, 40 | `cobro próximo` (228.42), `intereses del ciclo` (4.80), `cartera en mora` (0.00) | `tienda_id = @tienda` |
| 41 | `VAN acumulado` (20.01) | `tienda_id = @tienda` |
| 45 | `listado capital` (223.62) | `tienda_id = @tienda` |
| 46 | `listado suma ítems` (228.42) | `JOIN listado_pago` con `tienda_id = @tienda` |
| 55, 56 | Compras con lista o contado distinto del detalle (0) | `c.tienda_id = @tienda` |
| 57, 58 | `T-000301 fecha de pago` y `en listados` | `tienda_id = @tienda`, porque el ticket es único por tienda |
| 59, 61 | `ALTA sin usuario` (1), `RECHAZO sin registro` (1) | `tienda_id = @tienda` |
| 66 | `hora de corte fija` (2) | `tienda_id = @tienda` |
| 172 a 174 | Negativa: ítem de otro cliente | `l.tienda_id = @tienda` |

Las líneas 32 a 37, 47 a 51, 60, 62 a 65 y 67 a 76 ya filtran por cliente, compra o tienda. Las demás pruebas negativas (líneas 87 a 166) no cambian y se revierten.

**Chequeos nuevos:**

| Chequeo | Esperado |
|---|---|
| `productos de Doña Rosa` | 9 |
| `tiendas de demostración` (los 5 RUC) | 5 |
| `tiendas activas` | 5 |
| `meses con alta de tienda` (`COUNT(DISTINCT FORMAT(fecha_hora, 'yyyy-MM'))`, `ALTA`, `tienda`) | 6 |
| `filas ALTA tienda` | 6 |
| `Peluquería Estilo INACTIVO` | 1 |
| `su fila BAJA tienda` | 1 |
| `dueña de Peluquería Estilo INACTIVO` y su fila `BAJA usuario` | 1 y 1 |
| `clientes en tiendas de demostración` | 0 |
| `compras en tiendas de demostración` | 0 |
| `usuarios activos` (6) y `filas LOGIN` (8) | 6 y 8 |

La línea 193 imprime el total sola. **Comprobación de cifras:** el lote no inserta en `cliente`, `compra`, `compra_detalle`, `cuota`, `listado_pago`, `listado_item` ni `pago`. Ninguna cifra de 6.4 se calcula con otra tabla. D01 filtra por tienda en `enTienda`. Los ids de Doña Rosa no se mueven porque su lote corre primero.

### 2.4 Pruebas que dependen de las semillas

| Archivo | Efecto | Ajuste |
|---|---|---|
| `packages/finance/test/semillas.test.ts` | No se rompe: sus patrones no aparecen en el lote nuevo y `revisadas` sigue en 6 | Una prueba de texto: desde el comentario del lote nuevo, el archivo no contiene `INSERT INTO` para `cliente`, `compra`, `compra_detalle`, `cuota`, `listado_pago`, `listado_item` ni `pago` |
| `apps/api/test/integracion/01-semillas.e2e.spec.ts:70-71` | Sigue en verde | Sin cambio. D01, D06 y C03 siguen probando que las cifras no cambiaron |
| Ídem | Faltan las tiendas nuevas | Pruebas nuevas de la sección 2.5 |
| `juegos.e2e.spec.ts:116-120` | Sigue en verde: un segundo corte no emite ni audita, porque las tiendas nuevas no tienen clientes | Sin cambio |
| `aislamiento.e2e.spec.ts:226-230` y `auditoria-errores.e2e.spec.ts:177-179` | Siguen en verde: la fila 11 se enmascara | Sin cambio |
| `auditoria-errores.e2e.spec.ts:197` | `lista[0]` sigue siendo Doña Rosa, por `orderBy id` | Sin cambio |
| `db/verificar.sh` y `preparar-bd.mjs` | Corren el archivo nuevo sobre una BD limpia | Sin cambio |

### 2.5 Pruebas nuevas en `01-semillas.e2e.spec.ts`

`00-prisma.spec.ts` crea 2 tiendas con giro Minimarket, sin fila `ALTA`. Por eso no se comparan conteos exactos de `tiendasActivas`; los exactos están en `verificar_semillas.sql`.

| Caso | Esperado |
|---|---|
| A02 | `altasPorMes` contiene `2026-04` a `2026-09`, con 1 cada uno. `tiendasPorGiro` contiene Bodega, Panadería, Pollería y Librería, y no Peluquería |
| A02 | Con reloj 22/09: `operacionesPorDia` del 16/09 = 2 y del 17/09 = 2. Del 22/09, al menos 4, porque cada login suma |
| A03 | Peluquería Estilo llega con `estado: 'INACTIVO'` y `duenio.estado: 'INACTIVO'` |
| A04 | Elena con `INACTIVO`, tienda Peluquería Estilo y último acceso `2026-09-10T18:00:00`. Carlos con 2 tiendas (C3) |
| A05 | `?tiendaId=` de Peluquería trae `BAJA tienda`. La fila de PAN01 se lee `S/ *** a S/ ***` |
| Login | Elena con `Tienda#2026`: 401 `CREDENCIALES` |
| D01 | Ana: `porMoneda` vacío y `clientes: 0` |
| Selector | Carlos: `tiendas` con 2. Con `cambiar-tienda`, `GET /productos` da POL01 y no BOD01 |

### 2.6 Corte y resúmenes de plataforma

| Punto | Efecto |
|---|---|
| Corte global (`cortes.ts:73` y `:100`) | Ninguno. Recorre listados `EMITIDO` y clientes con `dia_corte` de hoy: estas tiendas no tienen ninguno |
| `tiendasActivas`, `usuariosActivos` | Cambian a 5 y 6. Es lo que se busca |
| `clientesRegistrados` | Sigue en 2 (por comparar con la Figura 2) |
| `tiendasPorGiro` | Filtra por `ACTIVO`: Peluquería no entra. "Por comparar" con la Figura 2; el punto de cambio es una línea de `plataforma.service.ts:377` |
| `operacionesHoy` | 4 sembradas, más cada login de esa fecha |

**Por qué no traen clientes ni compras.** A02 y A03 solo piden conteos, y A02 prohíbe montos (línea 2057). 6.4 dice que ambos juegos usan Doña Rosa (línea 3283). Un cliente con `dia_corte = 20` entraría al corte global y cambiaría `omitidos`. Tampoco hacen falta para ninguna pantalla de esta fase.

### 2.7 Qué pasa con `db/demo/pantallas.sql` (fase 3, sección 11, punto 10)

| Dato | Decisión |
|---|---|
| Peluquería Estilo, usuario inactivo, más auditoría | **Pasan a estas semillas** (A02 a A05) |
| Pagos anteriores | **Quedan fuera:** cambiarían `filas pago`, SU o listados. Lo decide la fase 5 o 6 para C07 |
| Reemplaza | La frase de fase 3 "sembrarlos en `db/init` rompería los conteos" queda superada por la decisión de Adrián |

**Documentos que debe actualizar la sesión principal:** `docs/diseno/fases-1-2.md:226` (la nota de 10 filas vale solo para Doña Rosa), `README.md` (tabla de usuarios de demo y secciones de semillas y reloj).

## 3. Cambios en la API

Sin rutas nuevas: `aislamiento.e2e` y su meta-prueba no cambian. Se agregan campos y no se quita ninguno.

| # | Archivo | Cambio exacto | Por qué | Prueba |
|---|---|---|---|---|
| **C1** | `apps/api/src/compras/compras.ts`, `calcularCompra` y `simular` | `limite` agrega `limite`, `su`, `usoActualPorcentaje` y `usoConCompraPorcentaje`. Los dos últimos con `usoLimite(...).toFixed(1)`, igual que D01 | La barra de D04 (línea 2209) necesita proporciones; la web no puede hacer esa cuenta | `juegos.e2e`, María sin deuda: `'0.0'` y `'43.0'`. `01-semillas`, reloj 22/09, Luis P003×99.900: `aceptada: false`, `disponible '255.08'`, `su '244.92'`, `'49.0'`, `'248.8'` (a mano) |
| **C2** | `compras.ts`, `cronograma` | `compra` agrega `clienteId` y `moneda` | D05 no sabe si poner S/ o US$ | `juegos.e2e`: `k.compra.moneda === 'PEN'` |
| **C3** | `plataforma.service.ts`, `usuarioDto` | Agrega `tiendas: [{id, nombreComercial}]`. `tienda` sigue igual | A04 debe mostrar a Carlos con sus 2 tiendas. Con `findFirst`, el filtro por Pollería lo mostraría con Bodega | `01-semillas`, sección 2.5. **Recortable** (sección 12) |

**Lo que no se cambia y la web resuelve sola:**

- Nombre y moneda de `GET /listados` y `GET /compras`: la web los cruza con `GET /clientes?tamano=200`. Límite conocido de 200 clientes por tienda.
- Filtro "pendientes" de D06 y D07: en la web, sobre `estadoEfectivo`. El filtro `estado` de la API mira la columna y con reloj fijo un listado vencido sigue `EMITIDO`.
- Fórmula desarrollada de D07: sale de `listado.total`, `cliente.tedMora`, `liquidacion.diasMora` y `liquidacion.mora`.

## 4. Estructura de `apps/web`

### 4.1 Librerías

| Librería | Para qué | Por qué |
|---|---|---|
| `react-router-dom` 6 | Rutas por perfil | Prompt, sección 7 |
| `@tanstack/react-query` 5 | Datos del servidor, caché y estados | Prompt, sección 7 |
| `react-hook-form` 7, `zod` 3, `@hookform/resolvers` | Formularios y validación en línea | Prompt, sección 7; T11 |
| `recharts` 2 | Barras y círculo | Prompt, sección 7. Otra librería contradiría el stack. Se carga con `React.lazy`, solo en A02 y D01, para aliviar su peso |
| `decimal.js` 10 | **Solo** porcentajes para mostrar y conversión de lo digitado | Regla de `CLAUDE.md`; sección 6 |
| `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom` (desarrollo) | Pruebas | Reutilizan la configuración de Vite; Jest exigiría otro transformador. Confirmar en el paso 3 que la versión de Vitest admite Vite 5 |

### 4.2 Archivos

| Ruta en `apps/web/` | Responsabilidad |
|---|---|
| `package.json` **(mod)**, `vite.config.ts` **(mod)** | Dependencias, `test`, configuración de Vitest |
| `Dockerfile` **(mod)** | `package-lock.json` y `npm ci`, igual que `apps/api/Dockerfile`, copiando los `package.json` de los otros espacios de trabajo |
| `src/App.tsx` **(mod)** | Enrutador. Reemplaza la página de salud; `GET /salud` pasa a la franja |
| `src/index.css` **(mod)** | Clases base y `@media print` de D06 |
| `src/api/cliente.ts` | `pedir<T>(ruta, opciones)`, token, `ErrorApi`, 401 global, 204 |
| `src/api/tipos.ts` | Tipos a mano de la sección 9 de fase 3 y de `src/`. `type Monto = string & {__marca:'Monto'}` y `type Tasa`. Swagger no describe las respuestas |
| `src/api/{auth,plataforma,cortes,productos,clientes,compras,listados,negocio,salud}.ts` | Una función por ruta |
| `src/sesion/{SesionContext.tsx,almacen.ts,Guarda.tsx}` | Sesión y guardas |
| `src/lib/formato.ts` | Únicos formateadores (sección 6) |
| `src/lib/entrada.ts` | Lo digitado a texto para la API. Sin montos calculados |
| `src/lib/grafico.ts` | Único punto con `Number()` sobre un monto (sección 6.3) |
| `src/lib/whatsapp.ts` | `mensajeListado`, `enlaceWhatsApp` |
| `src/lib/consultas.ts` | `QueryClient` |
| `src/ui/{Campo,Ayuda,Boton,Tabla,Estados,Franja,Kpi,Modal,Insignia,BarraUso,Graficos}.tsx` | Componentes comunes. `Campo` exige la prop `ayuda` (T11) |
| `src/plantillas/{PlantillaWeb,FranjaReloj,SelectorTienda,MenuLateral}.tsx` | Plantilla por perfil |
| `src/pantallas/admin/{A01Login,A02Resumen,A03Tiendas,A04Usuarios,A05Auditoria}.tsx` | Administrador |
| `src/pantallas/dueno/{D01..D08}.tsx`, `TablaListado.tsx`, `FlujoCaja.tsx` | Dueño |
| `src/contenido/{ayudas.ts,formulas.tsx}` | Textos de T12 y demás globos; artículos de D08 |
| `eslint.config.mjs` **(raíz, mod)** | Sección 6.4 |
| `package.json` **(raíz, mod)** | `test:web`; `npm test` también la ejecuta |

### 4.3 Rutas y plantillas

| Ruta | Pantalla | Perfil |
|---|---|---|
| `/` | Redirige según perfil | |
| `/login` | A01 | Público |
| `/admin`, `/admin/tiendas`, `/admin/usuarios`, `/admin/auditoria` | A02, A03, A04, A05 | `ADMIN_SISTEMA` |
| `/dueno` | D01 | `DUENO` |
| `/dueno/compras/nueva` | D04 | `DUENO` |
| `/dueno/clientes`, `/dueno/clientes/:id` | D03 | `DUENO` |
| `/dueno/listados`, `/dueno/listados/:id` | D06 | `DUENO` |
| `/dueno/pagos`, `/dueno/listados/:id/pago` | D07 | `DUENO` |
| `/dueno/cronogramas`, `/dueno/cronogramas/:compraId` | D05 | `DUENO` |
| `/dueno/productos` | D02 | `DUENO` |
| `/dueno/ayuda`, `/dueno/ayuda/:tema` | D08 | `DUENO` |
| `/m/*` | **Reservado para la fase 5.** Hoy, una página "Disponible en la fase 5" | `CLIENTE` |
| `*` | "Esta página no existe" | |

El menú sigue el orden del informe: administrador con cuatro opciones (línea 2026); dueño: resumen, compras, clientes, listados, pagos, cronogramas, catálogo y ayuda (líneas 2130 a 2133). `PlantillaWeb` lleva `FranjaReloj`, nombre del usuario, `SelectorTienda` y salir.

### 4.4 Sesión y guardas

- **Almacén:** `sessionStorage`, clave `vecinopay.token`. Sobrevive a recargar y se pierde al cerrar la pestaña. El token dura 8 horas.
- **Al cargar:** si hay token, `GET /auth/yo` reconstruye usuario y tiendas. Nada del perfil se guarda aparte ni se lee del JWT: manda la API.
- **Al iniciar o cerrar sesión o al cambiar de tienda:** `queryClient.clear()`. Las claves de consulta del dueño llevan `tiendaId`. Así no quedan datos de una tienda en otra.
- **`Guarda perfil=...`:** sin sesión va a `/login`; con otro perfil, a su inicio. Es comodidad: la seguridad sigue en la API.
- **Selector de tienda:** solo con `tiendas.length >= 2` (decisión de Adrián). Llama a `POST /auth/cambiar-tienda`, guarda el nuevo token y limpia la caché.
- **Cambiar contraseña:** no se agrega pantalla. 6.2.1 y 6.2.2 no la tienen y A04 la restablece. La fase 5 usa la misma ruta en C08.

### 4.5 Errores

Toda respuesta no exitosa se convierte en `ErrorApi { estado, codigo, mensaje, detalles }`. El mensaje de la API se muestra tal cual, porque ya explica la regla y el valor correcto (T11).

| Estado | Comportamiento |
|---|---|
| 400, 409, 422 | Si `codigo` está en el mapa del formulario, va debajo de ese campo en rojo. Si no, en franja roja sobre el botón |
| 401 fuera de `/auth/login` | Limpia la sesión y vuelve a `/login` con "Tu sesión terminó" |
| 401 en `/auth/login` | Mensaje bajo el formulario |
| 403 | "No tienes permiso para esta acción" |
| 404 | "No existe o no pertenece a tu tienda" |
| 429 | Mensaje de la API, sin reintentar |
| 500 o sin red | "No se pudo completar la operación" y botón Reintentar en lecturas. **Nunca se reintenta un POST** |

**React Query:** sin reintentos en 4xx; `refetchOnWindowFocus` activo, para ver el cambio de `RELOJ_FIJO` al volver a la pestaña.

**Mapa de campos:** A03: `RUC_DUPLICADO`, `USUARIO_DUPLICADO`, `USUARIO_NO_ES_DUENO`, `CLAVE_REQUERIDA`, `COK`. A04: `USUARIO_DUPLICADO`, `PERFIL_NO_PERMITIDO`, `AUTOBAJA`. D02: `CODIGO_DUPLICADO`, `PRECIO_LISTA`, `PRECIO_CONTADO`, `MODALIDAD`. D03: `DNI_DUPLICADO`, `TASA_*`, `MAX_MESES`, `MONTO`, `CONDICIONES_CON_DEUDA`. D04: `LIMITE_EXCEDIDO`, `MODALIDAD`, `CUOTAS_RANGO`, `TIR_SIN_RAIZ`, `CICLO_CERRADO`, `CLIENTE_INACTIVO`, `PRODUCTO_INACTIVO`, `CANTIDAD`. D07: `PAGO_NO_EXACTO`, `LISTADO_YA_PAGADO`. Los códigos multilínea de `validaciones.ts` se confirman al implementar; uno no mapeado cae en la franja, así que no se pierde el mensaje.

### 4.6 Carga, vacío y envío de datos

- `Estados.tsx`: `<Cargando/>` con esqueleto, `<Vacio texto/>` y `<ErrorPanel error reintentar/>`. Cada pantalla define su texto vacío. Mientras se envía, el botón queda deshabilitado para evitar el doble envío.
- **Formularios y API.** En un `POST`, un opcional vacío **se omite**, porque `""` se guardaría o fallaría el patrón de `imagenUrl`. En un `PATCH`, **solo se envían los campos cambiados** (`dirtyFields`); `""` vacía la columna; `null` da 400.
- **Campos de tipo lista:** T6 define listas cerradas. Plazo y capitalización son `select` con 1, 15, 30, 60, 90, 120, 180 y 360.

## 5. Pantallas

"API" indica si el dato ya llega: **Sí** significa que llega hoy. Toda ruta lleva el prefijo `/api`. Los montos se formatean según la sección 6.

### A01 Inicio de sesión (líneas 2030 a 2038; RF01)

| Campo o acción | API | Validación y mensaje |
|---|---|---|
| Usuario | `POST /auth/login` | Obligatorio; hasta 120. "Escribe tu correo o tu DNI." |
| Contraseña | Ídem | Obligatorio |
| Perfil: "Administrador del sistema" (`ADMIN_SISTEMA`), "Administrador del negocio" (`DUENO`) | Ídem | Obligatorio. `CLIENTE` no se ofrece (fase 3, 9.2) |
| Ingresar | Ídem | 401: "Usuario, contraseña o perfil incorrectos." 429: mensaje de la API |
| Nombre y lema a la izquierda; aviso "Cada inicio de sesión queda registrado" | Estático | Lema **por comparar** con la Figura 1 |

El globo de ayuda se abre al pasar el mouse o tocarlo (T11); la figura lo muestra abierto solo como ilustración. Tras entrar: `/admin` o `/dueno`.

### A02 Resumen de la plataforma (líneas 2049 a 2058; RF10)

Todo sale de `GET /plataforma/resumen`. **API: sí.** Solo conteos.

| Elemento | Campo | Esperado al 22/09/2026 con la primera entrada del administrador |
|---|---|---|
| Tiendas activas | `tiendasActivas` | 5 |
| Usuarios activos | `usuariosActivos` | 6 |
| Clientes registrados | `clientesRegistrados` | 2 |
| Operaciones de hoy | `operacionesHoy` | 5: las 4 sembradas más este login |
| Barras: altas por mes | `altasPorMes` | Abr a sep, 1 cada uno |
| Barras: últimos 7 días | `operacionesPorDia` | 16/09: 2; 17/09: 2; 18/09: 1; 19/09: 1; 20/09: 2; 21/09: 3; 22/09: 5 |
| Círculo por giro | `tiendasPorGiro` | Bodega, Librería, Minimarket, Panadería y Pollería, 1 cada uno |
| Últimas operaciones | `ultimasOperaciones` | 10 filas, sin detalle |

En las últimas operaciones, un usuario `null` se muestra como "Sistema". El botón de corte de la sección 8 solo aparece en esta pantalla.

### A03 Tiendas (líneas 2069 a 2077; RF02)

**API:** `GET /tiendas`, `POST /tiendas`, `PATCH /tiendas/:id`, `PATCH /tiendas/:id/estado`. **Datos: sí.**

| Campo | Validación y mensaje |
|---|---|
| RUC | "El RUC debe tener 11 dígitos." 409: "Ya existe una tienda con ese RUC." |
| Razón social (hasta 150), nombre comercial (hasta 100) | Obligatorios |
| Giro | Hasta 40; `datalist` con Bodega, Minimarket, Panadería, Peluquería y Pollería, para evitar variantes en el círculo de A02 |
| Teléfono (hasta 15), dirección (hasta 200) | Opcionales |
| Usuario del dueño | Obligatorio al crear; no se edita. Si ya existe con perfil de dueño, se reutiliza (T24) |
| Clave temporal | 8 o más caracteres. Si falta con un usuario nuevo: "Indica una clave temporal para el dueño nuevo." |
| COK, en porcentaje; por defecto 20 (T6) | Mayor que 0: "El COK de la tienda debe ser mayor que cero." Se envía en tanto por uno |

- **Tabla:** RUC, nombre comercial, giro, dueño, estado, con filtro de texto.
- **Etiqueta:** `INACTIVO` se muestra como **BAJA** (decisión de Adrián). Cualquier otra pantalla muestra `INACTIVO`.
- **Acciones:** guardar y dar de baja, con confirmación. Sobre una tienda en BAJA el botón se deshabilita. No se ofrece reactivar: la línea 2075 solo habla de guardar o dar de baja.
- **Historial** (línea 2077): enlace a `/admin/auditoria?tiendaId=`.
- **Por comparar:** Figura 3. `nombresDueno` no se pide, porque 6.2.1 no lo lista: el dueño nuevo se llama como la tienda hasta editarlo en A04.

### A04 Usuarios (líneas 2088 a 2096; RF11)

**API:** `GET /usuarios`, `POST /usuarios`, `PATCH /usuarios/:id`, `POST /usuarios/:id/restablecer-clave`, `PATCH /usuarios/:id/estado`, `GET /tiendas` para los selectores. **Datos: sí, y C3 para las tiendas.**

| Campo | Validación y mensaje |
|---|---|
| Perfil | Solo Administrador del sistema o Administrador del negocio al crear; no se edita. Globo: "El perfil define qué pantallas ve la persona." `CLIENTE` no se crea aquí (6.1.1) |
| Usuario | Obligatorio; no se edita. 409: "Ya existe un usuario con ese nombre." |
| Nombre | Obligatorio, hasta 160 |
| Tienda asignada | Solo dueños. **Obligatoria al crear dueño:** "Un dueño sin tienda no puede ingresar." Aviso: "La tienda pasará a este usuario." (`asignarTienda` cambia `duenio_id`) |
| Clave temporal | 8 o más; obligatoria al crear |

- **Tabla:** nombre, usuario, perfil, tiendas, último acceso, estado. Filtros: texto, perfil, tienda.
- **Acciones:** guardar; restablecer clave con un modal que pide la temporal; dar de baja, con confirmación. 409 `AUTOBAJA`: "No puedes dar de baja tu propio usuario."
- **Clientes:** se pueden listar y restablecer, no crear.

Al 22/09: 7 usuarios; Elena INACTIVO; Carlos con Bodega El Vecino y Pollería El Buen Sabor.

### A05 Auditoría (líneas 2107 a 2116; RF01, RF11)

**API:** `GET /auditoria?desde&hasta&tiendaId&usuarioId&accion&pagina&tamano`, `GET /tiendas`, `GET /usuarios`. **Datos: sí.**

- **Filtros (5):** fecha inicial, fecha final (si inicial es mayor: "La fecha inicial no puede ser posterior a la final."), tienda, usuario y acción (ALTA, BAJA, CAMBIO, LOGIN, RECHAZO).
- **Tabla:** fecha y hora con segundos, usuario (`null`: "Sistema"), tienda (`null`: "Plataforma"), acción, tabla, registro, detalle. Paginación con `total`. Sin ninguna acción de edición.
- **Se muestra lo que entrega la API:** el enmascarado `S/ ***` lo hace `detalleParaAdmin`. **Por comparar** con la Figura 5.
- **Cobertura de la línea 2112:** alta de compra, corte, cambio de precio, baja de producto, logins y rechazo. Las seis clases ya están sembradas.

### D01 Resumen del negocio (líneas 2136 a 2148; RF10)

Todo de `GET /negocio/resumen`. **API: sí.** Sin clientes (`porMoneda` vacío): "Aún no tienes clientes." Los montos de PEN y USD no se mezclan: si hay dos monedas, una fila de indicadores por moneda.

| Elemento | Campo de `porMoneda.PEN` | Esperado al 22/09/2026 |
|---|---|---|
| Capital por cobrar | `capitalPorCobrar` | S/ 502.72 |
| Próxima fecha de pago | `cobroProximo` | S/ 228.42, 26/09/2026 |
| Intereses del ciclo | `interesesDelCiclo` | S/ 4.80 |
| Cartera en mora | `carteraEnMora` | S/ 0.00 |
| VAN acumulado | `vanAcumulado` | S/ 20.01 |
| Barras: ventas por semana | `ventasPorSemana` | A mano, semana que empieza el lunes: 17/08 44.20; 24/08 32.80; 31/08 63.82; 07/09 30.50; **14/09 310.10**; 21/09 21.30. Destaca la de la compra en cuotas |
| Círculo: modalidad | `ventasPorModalidad` | A mano: fin de mes 244.92; cuotas 257.80 |
| Barras: cobros por fecha | `cobrosPorFecha` | 26/09 228.42; 26/10 115.33; 26/11 93.25; 26/12 93.26 |
| Uso del límite | `usoLimite` | Luis 244.92 de 500.00, 49.0 %; María 257.80 de 600.00, 43.0 % |
| Productos más vendidos | `productosMasVendidos` | A mano: olla 184.90; hervidor 72.90; arroz 69.15; pollo 66.87; huevos 34.00; leche 32.00; aceite 30.00; fideos 7.80; azúcar 5.10 |

Etiquetas y valores **por comparar** con la Figura 6.

### D02 Productos (líneas 2160 a 2168; RF03)

**API:** `GET /productos`, `POST /productos`, `PATCH /productos/:id`, `PATCH /productos/:id/estado`. **Datos: sí.**

| Campo | Validación y mensaje |
|---|---|
| Código (hasta 30), nombre (hasta 120), unidad (hasta 5) | Obligatorios. 409: "Ya tienes un producto con ese código." |
| Marca (60), proveedor (150), descripción (500) | Opcionales |
| Precio contado | Más de 0, hasta 2 decimales |
| Precio de lista | "El precio de lista debe ser mayor o igual que el precio contado." Comparación con `decimal.js` en `entrada.ts`; la API decide |
| Imagen | URL `.jpg`, `.jpeg` o `.png`, hasta 300 (decisión de Adrián): "La imagen debe ser una URL .jpg o .png." Vista previa, con texto de reemplazo si no carga |
| Interruptores: fin de mes y cuotas | Al menos uno: "El producto debe permitir al menos una modalidad de venta." |

Tabla: código, nombre, contado, lista, modalidades, estado. Precios siempre en S/ (decisión registrada: T25 no tiene moneda).

### D03 Clientes y condiciones (líneas 2179 a 2192; RF04, RF12)

**API:** `GET /clientes`, `GET /clientes/:id`, `POST /clientes`, `PATCH /clientes/:id`, `PATCH /clientes/:id/estado`, `POST /clientes/calcular-tasas`. **Datos: sí.**

| Panel | Campo; por defecto (T6) | Validación y mensaje |
|---|---|---|
| Datos | DNI | "El DNI debe tener 8 dígitos." 409: "Ya tienes un cliente con ese DNI." No se edita |
| Datos | Celular (15), dirección (200) | Opcionales |
| Datos | Nombres, apellidos (80) | Obligatorios |
| Datos | **Usuario para la aplicación** | Solo lectura: es el DNI (T7, `activar`). Muestra "Activado" o el código pendiente |
| Datos | Aceptación del tratamiento de datos | Obligatoria al crear: "Debe constar que el cliente aceptó el tratamiento de sus datos personales." Al editar, marcada y bloqueada |
| Condiciones | Tipo de tasa; Efectiva | Obligatorio |
| Condiciones | Valor; 45 | Más de 0, hasta 7 decimales. Se envía en tanto por uno |
| Condiciones | Plazo; 360 | Lista cerrada |
| Condiciones | Capitalización; 1 (diaria) | Solo si es nominal. "La capitalización no puede ser mayor que el plazo." |
| Condiciones | Moneda; PEN | Obligatoria |
| Condiciones | Límite; 500.00 | Más de 0 |
| Condiciones | Tasa moratoria: tipo, valor, plazo, capitalización; TEA 10 | Igual que la compensatoria |
| Condiciones | Máximo de meses; 3 | "El máximo de meses debe estar entre 1 y 12." |
| Condiciones | Día de corte; 20 | De 1 a 28. Texto fijo: "El cierre es a las 17:00, hora fija del sistema." |
| Condiciones | Día de pago; 26 | De 1 a 28 y distinto del corte |

- **Franja TED, TEM, TEA:** `calcular-tasas` con espera de 300 ms, solo con la tasa válida. Formato en sección 6.2. María: TED 0.1147372 % (0.0011473720), TEM 3.5000000 %, TEA 51.1068657 %. Luis: TED 0.1032654 % (0.0010326538).
- **Lista:** cliente, tasa con etiqueta (`TEA 45 %`, `TNA 42 %, capitalización mensual`), límite, disponible, estado. Al 22/09: Luis 500.00 y 255.08; María 600.00 y 342.20. `GET /clientes` ya los trae.
- **Código de activación:** tras crear, un modal lo muestra una vez y se puede copiar. Mientras esté pendiente, también en la ficha (`GET /clientes/:id`).
- **Bloqueo con deuda (decisión de Adrián).** Si `su` no es `"0.00"`, se bloquean tasas, moneda y días, con este texto de la API: "No se pueden cambiar tasas, moneda ni días mientras el cliente tiene deuda: un listado emitido no cambia." Límite y máximo de meses siguen editables.
- **Importante:** el `PATCH` no debe enviar `tasa` ni `tasaMora` si no cambiaron. La API considera cambio de condiciones su sola presencia (`clientes.ts:279`).
- **Moratoria al editar:** se muestran tipo y valor guardados. Plazo y capitalización **no se guardan** (decisión de Adrián): aparecen vacíos y son obligatorios solo si el dueño cambia la moratoria.
- **Baja:** confirmación que avisa: "Bloquea compras nuevas y el acceso; la deuda se sigue cobrando."
- `deudaALaFecha` no se muestra: ninguna pantalla de 6.2 la pide.

### D04 Nueva compra (líneas 2204 a 2214; RF05, RF06, RF09)

**API:** `GET /clientes?estado=ACTIVO`, `GET /productos?estado=ACTIVO`, `POST /compras/simular`, `POST /compras`. **Datos: sí, y C1 para la barra.**

| Elemento | Origen | Validación y mensaje |
|---|---|---|
| Cliente | `GET /clientes` | Obligatorio; define moneda y máximo de cuotas |
| Línea: producto, cantidad | Catálogo y lo digitado | Cantidad mayor que 0, hasta 3 decimales |
| Línea: precio de lista, precio contado | Catálogo o `lineas[]` | Solo lectura. T6: el usuario no digita montos |
| Línea: subtotal; total | **Solo** `lineas[].subtotal`, `montoLista`, `montoContado` | Nunca se multiplica ni se suma en la web |
| Modalidad; FIN_MES | Interruptor | Se deshabilita la que algún producto no admite. La API confirma con `MODALIDAD` |
| Número de cuotas; `min(3, maxMeses)` | `select` de 1 a `maxMeses` | Solo en cuotas |
| Fecha de pago, primera cuota | `fechaPago`, `cuotas.primeraCuota` | Solo lectura. Sin fecha ni hora editable (6.1.1) |
| Barra del límite | `limite.usoActualPorcentaje`, `usoConCompraPorcentaje`, `disponible` | **C1.** Tramo de la compra en naranja (nota de la Figura 9). Ancho topado en 100 % con CSS; el texto muestra el valor real |
| Simulador, en cuotas | `cuotas.{g, capitalCapitalizado, interesGracia, cuotaFija, ultimaCuota, tceaPorcentaje, van}` | Se actualiza con espera de 300 ms |
| Las dos fórmulas con valores | `montoLista`, `cuotas.filas[].{monto, t, valorActual}`, `tirDiaria`, `cokTea`, `sumaValorActual`, `van` | Sin cálculos |
| Simulador, fin de mes | `finMes.{dias, interes, total}` | Globo "Interés estimado" de T12 |
| Confirmar | `POST /compras` | Sección siguiente |

- **Confirmar se habilita** cuando la simulación corresponde a lo que hay en pantalla (`!isPlaceholderData`), **incluso si `limite.aceptada` es falso.** El aviso rojo aparece antes, pero el clic debe llegar a la API: 6.4 exige que el rechazo quede en auditoría (línea 3409), y `simular` no audita: solo lo hace `POST /compras` (fase 3, 7.2). El 422 muestra el mensaje en la franja.
- **Después:** en cuotas, a D05 de la compra creada; a fin de mes, se muestra el ticket y se limpia el formulario.
- Un `CICLO_CERRADO` (solo con reloj fijo): se muestra el mensaje de la API. El caso está explicado en la sección 11.2.

**Esperado con reloj `2026-09-15T10:35:00-05:00`,** María, P012 y P013, 3 cuotas, sin confirmar: 257.80; 249.80; g 11; P' 261.07; interés de gracia 3.27; cuota 93.25; última 93.26; TCEA 51.09 %; VAN 20.01; pago 26/09/2026; primera cuota 26/10/2026. Barra 43.0 % a 85.9 % (a mano), porque las semillas ya contienen T-000284.

**Con reloj 22/09:** la misma compra da otro `g`, porque el 22 es posterior al corte. No es error: es la regla de T13.

### D05 Cronograma y flujo de caja (líneas 2225 a 2234; RF05, RF09)

**API:** `GET /compras?modalidad=CUOTAS` y `GET /compras/:id/cronograma`. **Datos: sí, y C2 para la moneda.**

| Bloque | Campos | T-000284 |
|---|---|---|
| Resumen | `resumen.montoCredito`, `diasGracia`, `interesGracia`, `interesCuotas`, `tceaPorcentaje` | 257.80; 11; 3.27; 18.69; 51.09 % |
| Tabla central | `filas[]` | Las 3 filas de T19, días 30, 31, 30, estado PENDIENTE |
| Totales | `totales.*` | 18.69; 261.07; 279.76 |
| Nota | Estática | Fórmulas de 6.3j y ajuste de la última cuota |
| Flujo de caja | `flujoCaja.filas[]` | Día 0: −249.80; 41: 91.33; 72: 89.91; 102: 88.56 |
| Total del flujo | `flujoCaja.sumaValorActual` y `van` | **269.81** y **20.01** |

- **No se suman filas:** las filas darían 269.80 y la nota de T20 lo explica. La web muestra `sumaValorActual` (`decisiones.md`).
- Si `cokVigenteCoincide` es falso: "El COK de la tienda cambió después de esta venta. La TCEA y el VAN son los guardados."
- También se muestran `interesesTotales` (21.96, T20) y `tirDiaria` (0.0011469966).

### D06 Listado de pago (líneas 2245 a 2257; RF08)

**API:** `GET /listados`, `GET /listados/:id`, `GET /listados/:id/valor-hoy`, `GET /clientes/:id`. **Datos: sí.**

| Elemento | Campos | `EC-202609-00001` |
|---|---|---|
| Encabezado | `numero`, `fechaCorte`, `horaCorte`, `fechaPago`, `cliente`, `tasa`; etiqueta de la tasa desde el cliente | 20/09/2026 17:00:00; 26/09/2026 |
| Tabla | `items[].{ticket, fechaHoraRegistro, fecha, detalle, dias, capital, interes, total}` | Tickets y cifras de T16 |
| Asterisco | `posteriorAlCorte` | T-000245 y T-000278 |
| Ítem `CUOTA` | "Cuota k" y `ticket` | |
| Ítem `MORA` (RF08) | "Interés moratorio, n días", y columna Mora solo si `totalMora` no es `"0.00"` | Sin fila hasta pagar con atraso |
| Última fila | `totalCapital`, `totalInteres`, `total` | 223.62; 4.80; **228.42**. Nunca suma de filas |
| Recuadro de atraso | `cliente.valorTasaMora`, `tedMora` y fórmula | Estático con datos |
| Recuadro de fórmulas | 6.3h con valores | Estático con datos |
| Franja verde | `comprasPosteriores[]` | T-000301, 20/09/2026 17:45, S/ 21.30, pago 26/10/2026 |
| Mora a la fecha | `moraALaFecha` | Solo si `diasMora > 0` |
| Valor de hoy, ver **[ESCALAR] E1** | `valor-hoy?fecha=` | Con 16/09/2026: `td` 10; d 1.0268129 %; descuento 2.35; neto 226.07. Oculto si está PAGADO |

- **Lista:** número, cliente, corte, pago, total, `estadoEfectivo`. Filtros de cliente y estado, en la web (sección 3).
- **Botones:** sección 7.
- `TablaListado.tsx` no depende del perfil. Así C05 lo reutilizará en la fase 5.

### D07 Registrar pago (líneas 2269 a 2278; RF07)

**API:** `GET /listados/:id`, `GET /listados/:id/liquidacion`, `GET /clientes/:clienteId`, `POST /listados/:id/pago`. **Datos: sí.** `/dueno/pagos` lista los no pagados según `estadoEfectivo`.

| Elemento | Origen | Validación y mensaje |
|---|---|---|
| Fecha y hora real de pago | `liquidacion.fechaReal`, `horaReal` | **Solo lectura** (decisión de Adrián). Si la fecha operativa es otra: "Cuenta como del 27/09/2026" |
| Monto pagado; por defecto `totalALaFecha` (T6) | Editable | Formato de monto en la web. **No se compara con el total en la web:** decide la API |
| Medio de pago | `Efectivo`, `Yape`, `Plin`, `Transferencia` | Obligatorio; valores exactos de `PagoDto` |
| Número de operación | Texto | Opcional, hasta 30 |
| Total a la fecha | `listado.total`, `liquidacion.diasMora`, `mora`, `totalALaFecha` | Sin cálculos |
| Fórmula desarrollada | `listado.total × [(1 + cliente.tedMora)^diasMora − 1] = mora` | Solo si hay mora |
| Imputación | `liquidacion.imputacion.{mora, interes, capital}`, total `totalALaFecha` | Prelación fija |
| Disponible después | `liquidacion.disponibleDespues` | |

- **Rechazo (422 `PAGO_NO_EXACTO`):** franja roja arriba con `mensaje`. Campo en rojo con "Monto correcto: S/ 228.72", tomado de `detalles.totalALaFecha`. **El botón nunca se bloquea por el monto,** para que el rechazo quede en auditoría (fase 3, 7.4) y se vea lo de la Figura 12.
- **Tras un rechazo:** se vuelve a consultar la liquidación.
- **Aceptado (201):** recibo con `pago`, `imputacion` y `disponible`, y enlace al listado.
- **409 `LISTADO_YA_PAGADO`:** "Este listado ya está pagado", con enlace.
- **Reloj real:** `refetchInterval` de 60 s, para reflejar el paso de las 17:00. Si cruza entre lectura y envío, la API rechaza con el total correcto.

| Reloj | `liquidacion` esperada | Acción |
|---|---|---|
| 26/09/2026 17:00:00 | Mora 0.00, total 228.42 | Sin pagar |
| 26/09/2026 17:30:00 | 1 día, mora 0.06, total 228.48. "Cuenta como del 27/09/2026" | Sin pagar |
| 01/10/2026 12:00:00 | 5 días, mora 0.30, total 228.72; imputación 0.30, 4.80, 223.62; disponible 478.70 | 200.00: rechazo. 228.72: aceptado |

### D08 Ayuda y fórmulas (líneas 2289 a 2297; RF13)

**Sin API.** Contenido estático en `contenido/formulas.tsx`. Artículo: explicación, fórmulas, leyenda y ejemplo paso a paso (nota de la Figura 13).

| Tema | Fuente | Ejemplo |
|---|---|---|
| Conversión de tasas | 6.3c, d, f | TNA 42 % mensual: TED 0.0011473720, TEM 3.5000000 %, TEA 51.1068657 % (6.3f, línea 2855). Tema inicial, igual que la figura |
| Ciclo de corte y pago | 6.3e, g; T13 | 20/09 a las 17:45 pasa al 21/09 y se paga el 26/10 |
| Interés a fin de mes | 6.3h; T16 | T-000231: 35 días, 0.0367846, 1.63. Listado 228.42 |
| Mora y prelación | 6.3i; T17 | 5 días, 0.30, total 228.72; imputación 0.30, 4.80, 223.62 |
| Cuotas con gracia | 6.3j; T18, T19 | g 11; 261.07; 93.25; 93.26 |
| TCEA y VAN | 6.3k; T20 | TIR 0.0011469966; 51.09 %; 91.33, 89.91, 88.56; 20.01 |
| Tasa descontada | 6.3l; T14 | 10 días: 1.0268129 %; 2.35; 226.07 |
| Glosario | Sección 4 y T9 | Términos con su definición |

- **Fórmulas:** el `.txt` las trae como imágenes; se toman de `docs/prompt_desarrollo.md`, sección 3, y de las leyendas de 6.3. Se escriben con JSX y `<sup>`/`<sub>`, sin librería de fórmulas. **Por comparar** con la Figura 13.
- **Buscador:** filtro sin acentos ni mayúsculas sobre título y cuerpo.
- **Cifras:** literales copiadas del informe, sin calcular. Una prueba comprueba que estén todas.

### Ayuda en cada campo (RF13, T11, T12)

`Campo` exige `ayuda` por tipo, de modo que un campo sin globo no compila. `ayudas.ts` trae **los textos literales de T12** para D03 y D04; los demás se redactan desde 6.1.1 y T6 a T9, con qué es, formato y ejemplo. El globo se abre con mouse, foco y toque.

## 6. Dinero en la web

### 6.1 Reglas

1. Un monto es `Monto` (texto de la API). **Prohibido** `number`, `parseFloat`, `Number()` o aritmética sobre él, salvo el punto único de 6.3.
2. **Ninguna cifra financiera se suma ni se recalcula.** Subtotales, totales, cuotas, intereses, disponible y porcentajes de uso son siempre campos de la API. Ejemplo que lo justifica: `sumaValorActual` 269.81 frente a 269.80 de las filas.
3. El paquete `@vecinopay/finance` no se importa en la web. Lo único compartido es el contrato JSON. Así el cálculo solo existe en un lugar.
4. Comparar con `"0.00"` por texto es válido, porque la API siempre manda 2 decimales.

### 6.2 Formato (`lib/formato.ts`)

```ts
formatearMonto(m: Monto, moneda: 'PEN' | 'USD'): string
// "228.42"→"S/ 228.42"; "1234.50"→"S/ 1,234.50"; "93.25",USD→"US$ 93.25"; "-249.80"→"−S/ 249.80"
formatearPorcentajeApi(p: string): string           // "51.09"→"51.09 %"; "49.0"→"49.0 %"
formatearTasa(t: Tasa, decimales = 7): string       // "0.034999999999986"→"3.5000000 %"
formatearTasaResumida(t: Tasa): string              // "0.450000000"→"45 %"
formatearTasaDiaria(t: Tasa): string                // "0.001147371952051"→"0.1147372 % (0.0011473720)"
etiquetaTasa(tipo, plazo, capitalizacion): string   // TEA, TEM, TNA y "capitalización mensual"
formatearFecha(f: string): string                   // "2026-09-26"→"26/09/2026"
formatearFechaHora(fh: string, conSegundos = false) // "2026-08-29T18:40:00"→"29/08/2026 18:40"
```

- **Monto:** T6 define `S/ #,##0.00`. Solo manipula el texto. Si no cumple `^-?\d+\.\d{2}$`, lanza error: mejor un fallo visible que una cifra mal mostrada.
- **Tasas:** `decimal.js` con redondeo al más cercano. **No se corta el texto:** `0.034999999999986` cortado daría 3.4999999 % y 6.3f pide 3.5000000 %. No es recalcular una cifra financiera: es presentar la misma tasa.
- **TED:** T9 pide `0.0000000 %` y 6.3f, 6.4 y el prompt la escriben `0.0011473720`. Se muestran ambas (por comparar con la Figura 8).
- **TCEA:** T8 pide 2 decimales: se usa `tceaPorcentaje`.
- **Fechas:** solo manipulación de texto, sin `Date`. Evita correr un día por zona horaria. La fecha de hoy nunca sale del navegador: sale de `GET /salud` o de la API.

### 6.3 Único punto con número: gráficos (`lib/grafico.ts`)

Recharts necesita números para dibujar. `aValorGrafico(m: Monto): number` se usa solo como `dataKey`, para el alto de la barra o la porción del círculo. Etiquetas y globos muestran `formatearMonto` del texto original de la API. Se oculta el eje con importes. Nunca se suma ni se muestra ese número.

### 6.4 ESLint para `apps/web/src`

- **Prohibido:** `parseFloat`, `Number(`, `new Date()` sin argumentos y `Date.now()`. La única excepción es `Number` en `lib/grafico.ts`.
- **Importaciones:** `@vecinopay/finance` prohibido en toda la web. `decimal.js` solo en `lib/formato.ts` y `lib/entrada.ts`.
- **Lo digitado (`lib/entrada.ts`):** `porcentajeATantoPorUno("42")` da `"0.42"`, con `decimal.js`.
- **Enteros de lista** (`plazo`, `diaCorte`, `maxMeses`): la API exige `number` y no son montos. Se convierten con `z.coerce.number()`.

## 7. RF08 en D06: PDF y WhatsApp

### 7.1 PDF: impresión del navegador

- **Botón "Descargar PDF":** fija `document.title` en el número del listado, llama a `window.print()` y restaura el título.
- **`@media print`:** oculta menú, franja de reloj, botones y lista. Deja encabezado, tabla, recuadros y franja verde, en A4 vertical con paleta legible.
- **Por qué:** sin dependencias, con acentos y formato iguales a la pantalla, y C05 lo reutiliza. La alternativa, `jsPDF` con `autotable`, agrega peso y otro diseño que mantener.
- **Límite conocido:** se abre el diálogo y el usuario elige "Guardar como PDF". Si el auditor pide descarga directa, se cambia solo `descargarPdf()` por `jsPDF` con carga diferida.

### 7.2 WhatsApp: enlace `wa.me`

```ts
enlaceWhatsApp(celular: string, mensaje: string): string
// https://wa.me/51951284736?text=<encodeURIComponent>
```

- **Número:** `GET /clientes/:id`, solo dígitos; con 9 dígitos se antepone `51`. Sin celular, el botón se deshabilita: "Este cliente no tiene celular registrado."
- **Apertura:** nueva pestaña, con `rel="noopener noreferrer"`.
- **El mensaje** es texto, sin adjunto: `wa.me` no admite archivos. Lleva tienda (de la sesión), listado, cliente, corte, fecha de pago, capital, interés y total. Si `moraALaFecha.diasMora > 0`, también mora y total a la fecha. Todas las cifras salen de la respuesta de la API.

```
Minimarket Doña Rosa: listado EC-202609-00001
Luis Quispe
Corte: 20/09/2026 17:00:00
Fecha de pago: 26/09/2026
Capital: S/ 223.62
Interés: S/ 4.80
Total a pagar: S/ 228.42
Si pagas después de la fecha de pago se agrega interés moratorio.
```

No se audita: no cambia nada en el sistema, y la matriz de la fase 3, 8.1, solo registra operaciones de datos.

## 8. Reloj de la demo y corte manual

**Fecha visible.** `FranjaReloj` usa `GET /salud` (ya trae `relojFijo`, `fechaLima`, `horaLima`, `fechaOperativa`). Solo con `relojFijo: true`, en todas las pantallas:

> Demostración: reloj fijo en 22/09/2026 12:00:00 (hora de Lima). Si la fecha operativa es otra: "Cuenta como del 27/09/2026".

Se oculta al imprimir. **Justificación:** las cifras dependen de la fecha (nota de la Figura 6: "al 22/09/2026") y, con reloj fijo, no es la hora real. Con hora real, no aparece y las pantallas quedan iguales al informe.

**Cambiar la fecha:** no hay ruta ni control en la web (fase 3, 4.3). Se reinicia la API. El README suma la forma de PowerShell:

```powershell
$env:RELOJ_FIJO='2026-09-26T17:30:00-05:00'; docker compose up -d api
```

La sesión no se pierde: el JWT usa hora real. La franja y los datos se actualizan al volver a la pestaña.

**Corte manual: botón en A02, con dos condiciones.** Solo si `relojFijo` es verdadero, y solo con perfil administrador. "Ejecutar corte de hoy" pide confirmación, llama a `POST /cortes/ejecutar` y muestra `fecha`, el número de cada listado emitido, `omitidos`, `vencidos` y `errores`. **No muestra el campo `total`:** por 6.2.1, las pantallas del administrador no muestran montos. Antes de las 17:00:00 muestra el 409 `CORTE_NO_DISPONIBLE`.

**Por qué se agrega, si el informe no lo pide.**

1. Con reloj fijo no corre el cron (fase 3, 7.3).
2. `CLAUDE.md` prioriza el juego 1 y el juego 2 de punta a punta. El juego 2 no puede llegar a D07 sin los cortes del 20/10 y del 20/11: la Tabla 20 exige pagar la cuota 2 el 30/11.
3. La alternativa, Swagger, saca a la persona de la web en plena demostración.
4. **No altera el informe:** con hora real no se ve, y el corte sigue siendo automático. Pertenece al modo de demostración, no a la pantalla entregable.

**Recorrido de punta a punta, juego 2:**

| Reloj | Dónde | Resultado |
|---|---|---|
| `2026-10-20T17:00:01-05:00` | A02, corte | Listado con la cuota 1 de María. También el de T-000301 de Luis |
| `2026-10-26T12:00:00-05:00` | D07 de María | 93.25; sin mora |
| `2026-11-20T17:00:01-05:00` | A02, corte | Listado con la cuota 2 |
| `2026-11-30T12:00:00-05:00` | D07 de María | Mora 0.12; total 93.37; imputación 0.12, 6.40, 86.85 |

Un pago se puede hacer una sola vez: para repetir hay que recargar las semillas, y `docker compose down -v` borra datos: **pedir permiso a Adrián antes** (`CLAUDE.md`).

## 9. Fuera de alcance

- **C01 a C09:** fase 5. No se crean sus pantallas ni su plantilla.
- **Lo que queda listo sin estorbar:** `/m/*` reservado; `Guarda` genérico; `api/cliente.ts`, `sesion/` y `lib/formato.ts` no conocen pantallas; `TablaListado` no depende del perfil. `/login` no ofrece `CLIENTE`, de modo que C01 tendrá su propia ruta en `/m/login`.
- **Ayuda de C09:** el informe pide una versión más breve y sin términos técnicos (línea 2020). No se reutilizan los textos de D08.
- **Reactivar, cambiar contraseña en web, anular compras:** no están en 6.2.1 ni en 6.2.2.
- **Playwright:** fase 6.

## 10. Responsive

El informe dirige estas pantallas a escritorio (línea 1906), y el prompt pide una app responsive. Criterios:

| Ancho | Criterio |
|---|---|
| **Desde 1024 px (`lg`), objetivo** | Menú lateral fijo. Formulario junto a la tabla en A03, A04 y D02, como en 6.2. D01 con 5 indicadores en fila. D04 con simulador a la derecha |
| **De 768 a 1023 px** | Menú desplegable. Formulario debajo de la tabla. Indicadores en 2 o 3 columnas |
| **Desde 360 hasta 767 px** | Una columna. Toda función sigue disponible, con 1 indicador por fila |

**En todos los anchos:**
- **La página nunca tiene desplazamiento horizontal.** Las tablas anchas van en un contenedor con `overflow-x-auto`.
- Gráficos en `ResponsiveContainer`, con alto fijo.
- Controles táctiles de al menos 40 px. El globo se abre al tocar (T11).
- Tailwind con la paleta `vecino` `#115235` y `#1f7a4d`.

**Verificación:** cada pantalla en 1280, 768 y 375 px.

## 11. Plan de pruebas

### 11.1 Unitarias con Vitest (`npm run test -w apps/web`)

| Archivo | Casos |
|---|---|
| `lib/formato.test.ts` | Cada ejemplo de 6.2. TEM `0.034999999999986` da 3.5000000 %. TEA de María 51.1068657 %. TED 0.0010326538, 0.0011473720 y mora 0.0002647855. Sin `Date`: `2026-09-26` da `26/09/2026` en cualquier zona. `"abc"` lanza error |
| `lib/entrada.test.ts` | `"42"` da `"0.42"`; `"51.1068657"` da `"0.511068657"` sin error binario; rechaza más decimales |
| `lib/whatsapp.test.ts` | Mensaje exacto de 7.2. Número con 51. Sin celular. Acentos codificados |
| `api/cliente.test.ts` | Error con `{codigo, mensaje, detalles}`; 401 limpia sesión, salvo en login; 204; sin JSON |
| `sesion/Guarda.test.tsx` | Sin sesión, a `/login`. Otro perfil, a su inicio |
| `ui/Insignia.test.tsx` | `INACTIVO` en A03 da "BAJA"; en A04, "INACTIVO" |
| `pantallas/dueno/FlujoCaja.test.tsx` | **Filas que suman 269.80 y `sumaValorActual` 269.81: muestra 269.81** |
| `pantallas/dueno/TablaListado.test.tsx` | Total de la API distinto de la suma: muestra el de la API. Asterisco. Fila de mora |
| `pantallas/dueno/D04.test.tsx` | Con `aceptada: false`, Confirmar sigue activo; el 422 sale en la franja; sin subtotal hasta recibir la simulación |
| `pantallas/dueno/D07.test.tsx` | Con 200.00, envía; 422 muestra franja y "Monto correcto: S/ 228.72"; fecha y hora sin campo editable |
| `plantillas/FranjaReloj.test.tsx` | Con `relojFijo` falso, nada |
| `pantallas/admin/A02.test.tsx` | Sin reloj fijo, sin botón; la respuesta del corte no muestra importes |
| `contenido/formulas.test.ts` | Contiene 51.1068657, 228.72, 93.26, 51.09, 20.01, 1.0268129 y 226.07 |

La API se simula con un `fetch` falso; **las cifras de esas simulaciones deben coincidir con 6.4.**

### 11.2 En navegador, por pantalla

Con `docker compose up -d --build` y semillas recién cargadas. Por defecto, reloj 22/09/2026 12:00.

| Pantalla | Cómo | Debe verse |
|---|---|---|
| A01 | `admin@vecinopay.test` y `rosa@...`; luego una clave mala | Cada uno entra a su inicio; mensaje de credenciales; filas en A05 |
| A02 | Administrador | 5, 6, 2 y 5; 6 barras de altas; 7 días; círculo de 5 giros; sin montos |
| A03 | Administrador | Peluquería Estilo con **BAJA**; crear y dar de baja una tienda de prueba; RUC repetido |
| A04 | Administrador | 7 usuarios; Elena **INACTIVO**; filtro por tienda; restablecer clave |
| A05 | Administrador | Los 5 filtros; las 6 clases de la línea 2112; `S/ ***`; sin editar |
| D01 | Rosa | 502.72, 228.42, 4.80, 0.00, 20.01; uso 49.0 % y 43.0 %; cobros 228.42, 115.33, 93.25 y 93.26 |
| D01 vacío | Ana | "Aún no tienes clientes" |
| D02 | Rosa | 9 productos; precio de lista menor: mensaje; URL `.gif`: mensaje |
| D03 | Rosa | Luis y María; TNA 42 % mensual da 3.5000000 % y 51.1068657 %; condiciones bloqueadas con el motivo; límite editable; código `MDR-7K2Q` |
| Selector | Carlos | Aparece; al cambiar, el catálogo pasa de BOD01 a POL01. Rosa no lo ve |
| D04 | Reloj 15/09 10:35, María | Cifras de la sección 5, sin confirmar |
| D04 | Reloj 22/09, Luis, P003×99.900 | Aviso, Confirmar, 422 con 255.08 y fila `RECHAZO` en A05 |
| D05 | T-000284 | Tabla T19; 3.27; 18.69; 51.09 %; 269.81; 20.01 |
| D06 | `EC-202609-00001` | T16; asteriscos; franja T-000301; valor de hoy con 16/09: 2.35 y 226.07; PDF y WhatsApp |
| D07 | Relojes de la sección 5 | 228.42; 228.48; rechazo con 200; 228.72; 0.30, 4.80, 223.62; 478.70 |
| D08 | Rosa | 8 temas; buscar "mora" y "descontada"; sin errores en la consola |
| Responsive | 1280, 768, 375 | Sin desplazamiento horizontal |

**Sobre el 276.38 de 6.4 (línea 3408):** con las semillas, T-000301 ya está cargada, así que el rechazo muestra **255.08**, no 276.38. El resultado esperado por T17, "Rechazada", se cumple. 276.38 lo cubre `juegos.e2e` desde cero. Tampoco se puede probar con reloj 19/09 sobre las semillas: el ciclo de Luis ya está cerrado y responde `CICLO_CERRADO`.

**Criterio del prompt ("el juego 1 completo se puede ejecutar desde la web"):** se cumple sobre las semillas con las filas D01, D04, D06 y D07, incluido el pago. Una corrida desde cero (alta de tienda, 5 compras con 5 relojes y corte) es parte de la fase 6.

## 12. Plan de implementación

Cada paso termina con pruebas en verde, `npm run lint` y un commit.

| Paso | Commit | Entregable | Criterio verificable |
|---|---|---|---|
| 1 | `fase-4: semillas de tiendas de demostración` | Sección 2 | `npm test` y `npm run test:integracion` en verde. Sobre la BD actual, dos `docker compose up` sin error y sin duplicar: 31 filas si estaba sin operar. D01 de Rosa sigue en 502.72 |
| 2 | `fase-4: salidas de la api para la web` | C1, C2, C3 | Pruebas de la sección 3. La meta-prueba de `aislamiento.e2e` sigue en verde |
| 3 | `fase-4: base de la web` | Dependencias, Dockerfile, `api/`, `sesion/`, `lib/`, `ui/`, plantilla, ESLint | `docker compose build web` con `npm ci`. Unitarias de `lib/` y `api/`. Un `parseFloat` de prueba marca error |
| 4 | `fase-4: inicio de sesión y guardas (A01)` | A01, rutas, `FranjaReloj`, `SelectorTienda` | Fila A01 y selector de 11.2 |
| 5 | `fase-4: productos y clientes (D02, D03)` | D02, D03, globos de T12 | Filas D02 y D03 |
| 6 | `fase-4: listado de pago con pdf y whatsapp (D06)` | D06, `TablaListado` | Fila D06 |
| 7 | `fase-4: registrar pago (D07)` | D07 | Fila D07. **Juego 1 de punta a punta sobre las semillas** |
| 8 | `fase-4: nueva compra y simulador (D04)` | D04 | Filas D04 |
| 9 | `fase-4: cronograma y flujo de caja (D05)` | D05, `FlujoCaja` | Fila D05 |
| 10 | `fase-4: administración (A02 a A05) y corte de demo` | A02 a A05, botón de corte | Filas A02 a A05. **Juego 2 de punta a punta, sección 8** |
| 11 | `fase-4: resumen del negocio (D01)` | D01 | Fila D01, con reloj 22/09 y semillas recién cargadas |
| 12 | `fase-4: ayuda y fórmulas (D08)` | D08, `formulas.test.ts`, repaso de globos | Fila D08 |
| 13 | `fase-4: responsive y guía de prueba` | Ajustes, README, `decisiones.md`, `escalaciones.md` | Revisor y auditor; luego aprobación de Adrián |

**Si el tiempo se acorta, en este orden:**

1. C3: A04 muestra la primera tienda. Se conserva el resto del paso 2.
2. Paginación de A05 y filtros de texto de A03 y D02. Se conservan los 5 filtros de A05 y los 3 de A04: los pide el informe.
3. Vista previa de imagen, panel de `moraALaFecha` y responsive de 768 px. Se conserva 375 px sin romper.
4. Pruebas de componentes de A02 y `Guarda`. Se conservan las de `formato`, `FlujoCaja`, `TablaListado`, D04 y D07.
5. D08 con menos ejemplos, siempre con los 8 temas y buscador: es RF13.

**Nunca se recorta:** semillas, reglas de dinero, D04 a D07, guardas, D01, A02 a A05 ni los globos de T12.

## 13. Decisiones nuevas para `docs/decisiones.md`

| Tema | Decisión | Por qué |
|---|---|---|
| Semillas de demostración (Adrián) | Lote aparte e idempotente con 5 tiendas, 4 dueños, 4 productos y 21 filas de auditoría; sin clientes ni compras; verificación global más filtros por Doña Rosa | A02 a A05 no deben salir vacías; ninguna cifra de 6.4 cambia. Reemplaza el punto 10 de fase 3, sección 11, salvo pagos anteriores |
| Producto dado de baja | En Panadería San Martín, no en Doña Rosa | No cambia los 9 productos de Doña Rosa, que las pruebas copian |
| Dueño con 2 tiendas | Carlos, con Bodega y Pollería | Permite ver el selector sin tocar a Rosa |
| Salidas nuevas de la API | C1, C2 y C3; sin rutas | Evitar aritmética de montos en la web |
| Web sin motor | La web no importa `@vecinopay/finance`; `decimal.js` solo para presentar tasas y convertir lo digitado | El cálculo existe en un solo lugar |
| Gráficos | Recharts; `Number()` solo en `lib/grafico.ts`, para geometría; etiquetas con el texto de la API | Prompt, sección 7; Recharts solo admite números |
| Comprobación de montos | D04 y D07 no bloquean por monto: siempre envían | 6.4 y fase 3, 7.2 y 7.4: el rechazo debe quedar en auditoría |
| TED en pantalla | Porcentaje de T9 y tanto por uno de 6.3f | Dos formatos en el informe; por comparar con la Figura 8 |
| PDF | `window.print()` con `@media print` | Más simple que funciona; sin dependencias |
| WhatsApp | Enlace `wa.me`, con texto y sin adjunto | Sin API ni credenciales |
| Sesión | `sessionStorage`; caché limpia al cambiar de sesión o tienda | Evita datos de otra tienda |
| Franja y corte de demo | Solo con reloj fijo; botón solo en A02; sin importes en esa pantalla | Sin cron no hay listado; con hora real las pantallas quedan iguales a 6.2 |
| Reactivar y cambiar contraseña | Sin pantalla | 6.2.1 y 6.2.2 no los piden; la API los soporta |
| `tiendasPorGiro` | Solo activas; Peluquería no entra en el círculo | Implementado así; por comparar con la Figura 2 |

**En `docs/escalaciones.md`:** marcar la fila "Estado BAJA" como Resuelta, opción A, y agregar E1.

## 14. Riesgos y supuestos

**Sin confirmar porque nada se ejecutó:**

1. Versiones exactas de Recharts 2, Vitest y Router con React 18 y Vite 5.
2. `npm ci` con los espacios de trabajo en la imagen de la web.
3. Cifras a mano: `248.8`, `85.9`, ventas por semana y productos más vendidos. Las semanas y los productos suman 502.72, lo que da confianza, pero mandan la API y las pruebas.
4. `RELOJ_FIJO` en PowerShell sobre un `.env` que ya lo defina: Compose da prioridad al entorno de la terminal, por mi conocimiento; falta confirmarlo.

**Por comparar con el `.docx`, sin él no se puede dar por cerrado lo visual.** Las pantallas "deben parecerse a los mockups" (prompt, sección 6). Conviene que Adrián entregue el `.docx` o capturas antes de la auditoría:

| Figura | Qué comparar |
|---|---|
| 1 | Lema |
| 2 | Conteos, si la Peluquería cuenta por giro, clientes registrados |
| 3, 4 | Campos de los formularios y el nombre del dueño |
| 5 | Si el detalle muestra importes |
| 6 | Etiquetas de semanas, valores y productos |
| 7 | Modalidades de cada producto |
| 8 | Formato de TED y de la tasa en la lista |
| 9 | Barra del límite y fórmulas |
| 10, 11, 12 | Columnas y textos de los recuadros |
| 13 | Temas y fórmulas |

**Otros:**

- **Plazo:** la fase tiene 13 pasos, y aún faltan las fases 5 y 6 antes del 12/11. Si el paso 7 no ha terminado al segundo día de trabajo, se aplican los recortes de la sección 12.
- **Una sola ronda de pago por carga:** el recorrido de D07 consume el listado. Repetirlo requiere `down -v`, que es irreversible: lo autoriza Adrián.
- **Límite de 200:** los cruces de nombres usan `tamano=200`. Es suficiente para una tienda de barrio y para la demo.
- **Dueño de A04 al asignar tienda:** `asignarTienda` no audita el cambio de dueño de la tienda y el anterior puede quedar sin tiendas pero ACTIVO. Ya existe en la API; la pantalla avisa. No afecta a cifras.
- **Lo que ve el administrador:** con el corte de demo, la API devuelve `total` en su respuesta, pero la web no lo muestra. La respuesta no se cambia: es el contrato aprobado en la fase 3, 9.3, y esta ruta no tiene pantalla en el informe.
- **Reloj cambiado en mitad de un formulario:** el servidor recalcula al confirmar, de modo que la cifra guardada siempre es la correcta.
- **Filtro `estado` de la API:** no refleja `estadoEfectivo` con reloj fijo. La web filtra por este último (sección 3).

## 15. Puntos para escalar a Adrián

### [ESCALAR] E1. ¿Dónde se muestra el valor de hoy del listado?

**Tema:** T8 lo declara como salida, T14 y T17 lo prueban y 6.3l lo define, pero ninguna pantalla de 6.2 lo describe. El juego 1 no se ejecuta completo desde la web si no aparece en alguna.

- **A:** panel pequeño en D06, con fecha editable y `td`, `d`, descuento y neto, oculto si está pagado. Agrega un elemento que no está en la descripción de D06 y conviene una frase en el Word.
- **B:** solo como ejemplo estático en D08. No cambia D06, pero el escenario de T17 no se ejecuta en el sistema: quedaría en la API.

**Recomendación:** A. La API ya lo entrega y `fase-3.md` lo recomendó.
**Bloquea:** nada. Se implementa A aislada en un componente de D06. Si Adrián elige B, se quita ese componente.
