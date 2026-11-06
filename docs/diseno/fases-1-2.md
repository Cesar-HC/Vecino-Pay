# Diseño de las fases 1 y 2: esquema, semillas y motor financiero

Fuentes: `docs/informe_v8.txt`, `docs/prompt_desarrollo.md`, `CLAUDE.md`. Si se contradicen, gana el informe.
Las fórmulas de 6.3 son imágenes y en el `.txt` figuran como `[]`. Se toman de sus leyendas, de las Figuras 25 a 41 y de los ejemplos numéricos.

## 1. Orden de implementación

| Paso | Entregable | Commit | Criterio |
|---|---|---|---|
| 1 | `ejecutar.sh`, `01_esquema.sql` | `fase-1: esquema de 11 tablas` | `docker compose up` dos veces sin error |
| 2 | Motor y pruebas (sección 5 a 7) | `fase-2: motor financiero` | `npm test` en verde |
| 3 | `02_semillas.sql`, con literales que produce el motor, y `test/semillas.test.ts` | `fase-1: semillas de los juegos 1 y 2` | Carga una sola vez; la segunda ejecución no cambia nada |
| 4 | `db/verificar_semillas.sql`, `db/verificar.sh` | `fase-1: verificación de semillas` | Sale con código 0 |

El paso 2 va antes que las semillas porque TED, TEM y TCEA deben salir del motor.

## 2. Infraestructura de scripts

**`db/init/ejecutar.sh`:** agregar `-I -f 65001` a `sqlcmd`.
- `-f 65001`: lee los scripts como UTF-8. Todos los textos van como `N'...'`.
- `-I`: activa `QUOTED_IDENTIFIER`. `sqlcmd` lo deja apagado por defecto, y los índices filtrados y sus DML lo exigen.
- Los `.sh` deben quedar con fin de línea LF (`*.sh text eol=lf` en `.gitattributes`).

**`01_esquema.sql`:**
- Empieza con `USE VecinoPay; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; GO`.
- Cada tabla: `IF OBJECT_ID(N'dbo.x', N'U') IS NULL BEGIN CREATE TABLE ... END; GO`.
- Índices filtrados: `IF NOT EXISTS (SELECT 1 FROM sys.indexes ...)`.
- Triggers: `CREATE OR ALTER TRIGGER`, cada uno en su lote.
- Nunca hay `DROP`. Un cambio de esquema en desarrollo exige `docker compose down -v`.
- Sin `ON DELETE CASCADE`: la baja es lógica (6.1.1, Estado).

**`02_semillas.sql`:** un solo lote, sin `GO` después del encabezado.
1. `SET NOCOUNT ON; SET XACT_ABORT ON;`
2. Si existe `tienda.ruc = '10412587369'`, hace `PRINT` y `RETURN`.
3. `DECLARE` de literales, `BEGIN TRAN`, inserciones en el orden de la Tabla 34, `COMMIT`.

Los id son `IDENTITY` y se resuelven por clave natural (ticket, código, DNI). Reactivar la demo de C02 exige `docker compose down -v`, porque el código queda consumido.

**Prisma (fase 3):** introspecciona; no migra. Estos scripts mandan.

## 3. Esquema (Tablas 23 a 33)

Columnas, tipos y orden exactos de la sección 8, salvo las de 3.2.1. PK `id BIGINT IDENTITY` en todas. La columna "Origen" separa lo que dice el informe de lo que agrega este diseño. "Extra" no agrega columnas ni contradice el informe.

### 3.1 Tablas maestras

| Tabla | Restricción | Origen |
|---|---|---|
| **usuario** | `CK perfil IN (ADMIN_SISTEMA, DUENO, CLIENTE)` | T23 |
| | `UQ username`; `password_hash NOT NULL` | T23 |
| | `CK estado IN (ACTIVO, INACTIVO)`, default `ACTIVO` | T23 |
| **tienda** | `FK duenio_id → usuario NOT NULL` | T24 |
| | `UQ ruc`; `CK ruc LIKE` 11 veces `[0-9]` | T24 |
| | `CK cok_tea > 0`; `CK estado`; `direccion NULL` | T24 |
| **producto** | `FK tienda_id`; `UQ (tienda_id, codigo)` | T25 |
| | `CK precio_contado > 0`; `CK precio_lista >= precio_contado` | T25 |
| | `CK permite_fin_mes = 1 OR permite_cuotas = 1`; `CK estado` | T25 |
| | `marca, descripcion, proveedor, imagen_url NULL` | T25 |
| **cliente** | `FK tienda_id`; `UQ (tienda_id, dni)`; `CK dni LIKE` 8 veces `[0-9]` | T26 |
| | `FK usuario_id → usuario NULL` | T26 |
| | `UX usuario_id WHERE usuario_id IS NOT NULL` (un `UNIQUE` normal solo admitiría un NULL) | T34 |
| | `CK moneda IN (PEN, USD)`, default `PEN`; `CK limite_credito > 0`; `CK max_meses BETWEEN 1 AND 12` | T26 |
| | `CK dia_corte BETWEEN 1 AND 28`; `CK dia_pago BETWEEN 1 AND 28`; `CK dia_pago <> dia_corte` | T26 |
| | `hora_corte TIME NOT NULL DEFAULT '17:00:00'`; `CK hora_corte = '17:00:00'` | T26 |
| | `CK tipo_tasa`; `CK valor_tasa > 0`; `CK plazo_tasa IN (1,15,30,60,90,120,180,360)` | T6, T26 |
| | `CK (tipo_tasa='EFECTIVA' AND capitalizacion IS NULL) OR (tipo_tasa='NOMINAL' AND capitalizacion IN (lista) AND capitalizacion <= plazo_tasa)` | T26 |
| | `CK tipo_tasa_mora`; `CK valor_tasa_mora > 0`; `CK ted > 0`; `CK ted_mora > 0` | T26 |
| | `codigo_activacion NULL`; `CK estado` | T26 |
| | `UQ (id, tienda_id)`, destino de las FK compuestas | Extra |
| | `UX (tienda_id, codigo_activacion) WHERE codigo_activacion IS NOT NULL` | Extra |

### 3.2 Tablas de operación

| Tabla | Restricción | Origen |
|---|---|---|
| **compra** | `FK tienda_id`; `FK (cliente_id, tienda_id) → cliente(id, tienda_id)` | T27 + hecho 7 |
| | `UQ (tienda_id, ticket)`; `CK modalidad IN (FIN_MES, CUOTAS)` | T27 |
| | `CK monto_lista > 0`; `CK monto_contado > 0 AND monto_contado <= monto_lista` | T27 |
| | `CK estado IN (PENDIENTE, PAGADA, ANULADA)` | T27 |
| | `CK` modalidad: en `CUOTAS` son NOT NULL `num_cuotas, dias_gracia, capital_capitalizado, tem, cuota_fija, tcea, van`; en `FIN_MES` todas NULL | T27 |
| | `CK num_cuotas BETWEEN 1 AND 12`; `CK fecha_pago > fecha_corte` | Extra (T6, 6.3g) |
| **compra_detalle** | `FK compra_id`; `FK producto_id`; `CK cantidad > 0` | T28 |
| | `CK subtotal = ROUND(cantidad * precio_lista, 2)` | T28 |
| | `CK precio_contado > 0 AND precio_lista >= precio_contado` | Extra (T25) |
| | Trigger `TR_compra_detalle_misma_tienda` | Hecho 7 |
| **cuota** | `FK compra_id`; `UQ (compra_id, numero)` | T29 |
| | `CK monto = interes + amortizacion`; `CK saldo_final >= 0` | T29 |
| | `CK estado IN (PENDIENTE, PAGADA)` | T29 |
| | `CK numero >= 1`; `CK saldo_final = saldo_inicial - amortizacion` | Extra (6.3j) |
| **listado_pago** | `FK tienda_id`; `FK (cliente_id, tienda_id) → cliente(id, tienda_id)` | T30 + hecho 7 |
| | `UQ (cliente_id, fecha_corte)`; `CK total = total_capital + total_interes + total_mora` | T30 |
| | `CK estado IN (EMITIDO, PAGADO, VENCIDO)`; `fecha_pago_real, dias_mora NULL` | T30 |
| | `UQ (tienda_id, numero)`; `CK` componentes `>= 0`; `CK fecha_pago > fecha_corte` | Extra |
| | `CK (estado='PAGADO') = (fecha_pago_real y dias_mora NOT NULL)`, escrito con `OR`; `CK dias_mora >= 0` | Extra |
| **listado_item** | `FK listado_id`; `FK compra_id NULL`; `FK cuota_id NULL` | T31 |
| | `CK tipo IN (COMPRA, CUOTA, MORA)`; `CK total = capital + interes + mora` | T31 |
| | `CK` por tipo: `COMPRA` solo `compra_id`; `CUOTA` solo `cuota_id`; `MORA` ninguno y `capital = 0`, `interes = 0` | T31 |
| | `UQ (listado_id, orden)`; `CK orden >= 1`; `CK` montos y `dias >= 0` | Extra |
| | Trigger `TR_listado_item_mismo_cliente` | Hecho 7 |
| **pago** | `FK listado_id`; `UQ listado_id` | T32 |
| | `CK monto = mora_aplicada + interes_aplicado + capital_aplicado` | T32 |
| | `CK medio_pago IN (Efectivo, Yape, Plin, Transferencia)` | T32 |
| | `CK monto > 0`; `CK` aplicados `>= 0` | Extra |
| **auditoria** | `FK usuario_id NULL`; `FK tienda_id NULL`; `registro_id NULL`; `detalle NVARCHAR(MAX)` | T33 |
| | `CK accion IN (ALTA, BAJA, CAMBIO, LOGIN, RECHAZO)` | T33 |
| | `fecha_hora DATETIME2 NOT NULL DEFAULT CONVERT(DATETIME2, SYSDATETIMEOFFSET() AT TIME ZONE 'SA Pacific Standard Time')` | T33 + hecho 10 |
| | Trigger `TR_auditoria_solo_insercion` | T33 |

### 3.2.1 Columnas agregadas por decisión de Adrián (2026-11-06)

Se apartan de las Tablas 24 y 32, y el Word debe actualizarse. El informe no define sus tipos.

| Tabla | Columna | Regla |
|---|---|---|
| tienda | `giro VARCHAR(40) NOT NULL` | Dato de A03; alimenta el gráfico por giro de A02 |
| tienda | `telefono VARCHAR(15) NULL` | Dato de A03; mismo tamaño que `cliente.celular` |
| pago | `numero_operacion VARCHAR(30) NULL` | Dato de D07 y C07; opcional porque el efectivo no lo tiene |

### 3.3 Triggers

| Trigger | Evento | Regla |
|---|---|---|
| `TR_auditoria_solo_insercion` | `INSTEAD OF UPDATE, DELETE` | `THROW 50001, N'La auditoría solo admite inserciones.', 1` |
| `TR_compra_detalle_misma_tienda` | `AFTER INSERT, UPDATE` | `producto.tienda_id` debe ser igual a `compra.tienda_id` |
| `TR_listado_item_mismo_cliente` | `AFTER INSERT, UPDATE` | La compra de la línea, o la compra de la cuota, debe tener el `cliente_id` del listado. `COMPRA` exige `FIN_MES` |

## 4. Semillas

Los datos que no salen del informe llevan `-- FICTICIO (demo)` en el SQL. La cabecera del archivo explica esa marca.

### 4.1 Literales con nombre fijo

`test/semillas.test.ts` los localiza por nombre y los compara con el motor.

```sql
DECLARE @ted_luis   DECIMAL(18,15) = ...; -- cuantizarTasa(tasaEfectivaDiaria(EFECTIVA, 0.45, 360))
DECLARE @tedm_luis  DECIMAL(18,15) = ...; -- EFECTIVA, 0.10, 360
DECLARE @ted_maria  DECIMAL(18,15) = ...; -- NOMINAL, 0.42, 360, c = 30
DECLARE @tedm_maria DECIMAL(18,15) = ...; -- EFECTIVA, 0.12, 360
DECLARE @tem_maria  DECIMAL(18,15) = ...; -- cuantizarTasa(tem(@ted_maria))
DECLARE @tcea_maria DECIMAL(16,10) = ...; -- cuantizarTasa(tcea, 10)
```

La sesión principal genera estos valores y los hash con Node. No se copian de este documento porque aquí no hay cálculo ejecutado.

### 4.2 Usuarios, tienda y clientes

| Usuario | Perfil | Nombres | Contraseña de demo |
|---|---|---|---|
| `admin@vecinopay.test` | ADMIN_SISTEMA | Administrador VecinoPay | `Admin#2026` |
| `rosa@vecinopay.test` | DUENO | Rosa Mamani (ficticio) | `Tienda#2026` |
| `45872316` | CLIENTE | Luis Quispe | `Vecino#2026` |

Hash bcrypt de costo 10. Las contraseñas se documentan en el README. Los `$` de un hash no molestan a `sqlcmd`, que solo sustituye `$(var)`.

**Tienda:** RUC `10412587369`, nombre comercial `Minimarket Doña Rosa`, razón social `Rosa Mamani` (ficticio), giro `Minimarket` (ficticio), dirección y teléfono ficticios, `cok_tea` 0.200000000, ACTIVO.

| Campo | Luis Quispe | María Huamán |
|---|---|---|
| DNI | 45872316 | 40000002 (ficticio) |
| Celular | 951284736 | 999000111 (ficticio) |
| `usuario_id` | Luis | NULL |
| `codigo_activacion` | NULL | MDR-7K2Q |
| Moneda, límite | PEN, 500.00 | PEN, 600.00 |
| `max_meses` | 3 (default de T6) | 3 |
| Corte, hora, pago | 20, 17:00:00, 26 | 20, 17:00:00, 26 |
| Tasa | EFECTIVA, 0.45, p = 360, c NULL | NOMINAL, 0.42, p = 360, c = 30 |
| Mora | EFECTIVA, 0.10 | EFECTIVA, 0.12 |

Las direcciones de ambos son ficticias.

### 4.3 Productos (tienda Doña Rosa)

| Código | Nombre | Unidad | Contado | Lista | Fin de mes | Cuotas |
|---|---|---|---|---|---|---|
| P001 | Pollo entero | KG | 8.50 | 9.00 | 1 | 0 |
| P002 | Arroz 5 kg | UND | 22.50 | 23.05 | 1 | 0 |
| P003 | Aceite 1 L | UND | 9.50 | 10.00 | 1 | 0 |
| P004 | Leche evaporada | UND | 3.00 | 3.20 | 1 | 0 |
| P005 | Huevos plancha | UND | 16.00 | 17.00 | 1 | 0 |
| P006 | Fideos | UND | 3.60 | 3.90 | 1 | 0 |
| P007 | Azúcar 1 kg | UND | 4.80 | 5.10 | 1 | 0 |
| P012 | Olla arrocera | UND | 179.90 | 184.90 | 1 | 1 |
| P013 | Hervidor | UND | 69.90 | 72.90 | 1 | 1 |

Solo P012 y sus precios salen del informe (T7). El resto es ficticio y está elegido para cuadrar con los montos de T16.

### 4.4 Compras y detalle

`fecha_hora` es hora local de Lima. Todas quedan en estado PENDIENTE. `monto_contado` es la suma de `Red(cantidad × contado)`.

| Ticket | Cliente | Registro | F. operativa | Corte | Pago | Lista | Contado | Detalle |
|---|---|---|---|---|---|---|---|---|
| T-000231 | Luis | 2026-08-22 09:15 | 22/08 | 20/09 | 26/09 | 44.20 | 42.48 | P001×2.350, P002×1 |
| T-000245 | Luis | 2026-08-29 18:40 | 30/08 | 20/09 | 26/09 | 32.80 | 31.00 | P003×2, P004×4 |
| T-000262 | Luis | 2026-09-05 11:05 | 05/09 | 20/09 | 26/09 | 63.82 | 61.01 | P002×1, P001×1.530, P003×1, P005×1 |
| T-000278 | Luis | 2026-09-12 19:30 | 13/09 | 20/09 | 26/09 | 30.50 | 28.60 | P005×1, P004×3, P006×1 |
| T-000284 | María | 2026-09-15 10:35 | 15/09 | 20/09 | 26/09 | 257.80 | 249.80 | P012×1, P013×1 |
| T-000290 | Luis | 2026-09-18 08:50 | 18/09 | 20/09 | 26/09 | 52.30 | 50.03 | P002×1, P001×2.250, P006×1, P007×1 |
| T-000301 | Luis | 2026-09-20 17:45 | 21/09 | 20/10 | 26/10 | 21.30 | 20.05 | P001×1.300, P004×3 |

Solo T-000284 es `CUOTAS`, con `num_cuotas` 3, `dias_gracia` 11, `capital_capitalizado` 261.07, `tem` @tem_maria, `cuota_fija` 93.25, `tcea` @tcea_maria, `van` 20.01. Las demás son `FIN_MES`, con esos campos en NULL.

### 4.5 Cuotas de T-000284 (T19, todas PENDIENTE)

| Número | Vence | Saldo inicial | Interés | Amortización | Monto | Saldo final |
|---|---|---|---|---|---|---|
| 1 | 2026-10-26 | 261.07 | 9.14 | 84.11 | 93.25 | 176.96 |
| 2 | 2026-11-26 | 176.96 | 6.40 | 86.85 | 93.25 | 90.11 |
| 3 | 2026-12-26 | 90.11 | 3.15 | 90.11 | 93.26 | 0.00 |

### 4.6 Listado de Luis

`listado_pago`: número `EC-202609-00001`, corte 2026-09-20, pago 2026-09-26, capital 223.62, interés 4.80, mora 0.00, total 228.42, EMITIDO, `fecha_pago_real` y `dias_mora` NULL.

| Orden | Tipo | Compra | `fecha` (operativa) | Días | Capital | Interés | Mora | Total |
|---|---|---|---|---|---|---|---|---|
| 1 | COMPRA | T-000231 | 2026-08-22 | 35 | 44.20 | 1.63 | 0.00 | 45.83 |
| 2 | COMPRA | T-000245 | 2026-08-30 | 27 | 32.80 | 0.93 | 0.00 | 33.73 |
| 3 | COMPRA | T-000262 | 2026-09-05 | 21 | 63.82 | 1.40 | 0.00 | 65.22 |
| 4 | COMPRA | T-000278 | 2026-09-13 | 13 | 30.50 | 0.41 | 0.00 | 30.91 |
| 5 | COMPRA | T-000290 | 2026-09-18 | 8 | 52.30 | 0.43 | 0.00 | 52.73 |

María no tiene listado: su primera cuota entra al corte del 20/10. T-000301 tampoco está listada. `pago` queda vacía.

### 4.7 Auditoría (9 filas, `tienda_id` Doña Rosa)

| `fecha_hora` | Usuario | Acción | Tabla | `registro_id` | Detalle |
|---|---|---|---|---|---|
| La de cada compra | Rosa | ALTA | compra | id de la compra | Ticket, cliente, modalidad y monto (7 filas) |
| 2026-09-19 10:00:00 (ficticia) | Rosa | RECHAZO | compra | NULL | Compra de S/ 999.00 rechazada: supera el crédito disponible de S/ 276.38 |
| 2026-09-20 17:00:00 | NULL | ALTA | listado_pago | id del listado | Corte automático: listado EC-202609-00001 |

El rechazo se fecha antes de T-000301 porque 6.4 lo plantea con S/ 276.38 disponibles. Después de esa compra el disponible ya sería 255.08.

## 5. Motor: módulos (`packages/finance/src`)

| Archivo | Funciones | Tabla 21 | Sustento |
|---|---|---|---|
| `decimal.ts` | `Dec`, `Entrada`, `aDec`, `red`, `soles` | Redondear2 | 6.3e (piso), hecho 3 |
| `errores.ts` | `ErrorFinanciero`, `CodigoError` | n/a | 6.1 |
| `calendario.ts` (existe) | Agrega `fechaOperativaLocal`, `diasEntre`, `sumarMeses` | SerialExacto | 6.3e, Fig. 25 |
| `tasas.ts` | `tasaEfectivaDiaria`, `tasaDeDias`, `tem`, `tea`, `cuantizarTasa` | TasaEfectivaDiaria | 6.3c, d, f, Fig. 29 |
| `ciclo.ts` | `asignarCiclo` | AsignarCiclo | 6.3g, T13 |
| `listado.ts` | `interesCompra`, `listadoDePago` | ListadoDePago | 6.3h, Fig. 33 |
| `pago.ts` | `liquidarAFecha`, `registrarPago` | RegistrarPago | 6.3i, Fig. 35 |
| `cuotas.ts` | `capitalCapitalizado`, `cuotaFrancesa`, `planDeCuotas` | PlanDeCuotas | 6.3j, Fig. 37 |
| `indicadores.ts` | `tirDiaria`, `indicadoresVenta`, `simularVentaEnCuotas` | TirDiaria, IndicadoresVenta, Principal | 6.3k, Fig. 23, 39, 41, T22 |
| `descuento.ts` | `valorHoy`, `efectivaDesdeDescontada`, `valorPresenteEfectiva`, `valorPresenteSimple` | n/a | 6.3l, T14 |
| `comparacion.ts` | `interesSimple`, `montoSimple`, `montoCompuesto` | n/a | 6.3a, b, n, T15 |
| `resumen.ts` | `creditoDisponible`, `evaluarLimite`, `capitalPorCobrar`, `usoLimite`, `deudaALaFecha` | Principal (límite) | 6.3i, m, Fig. 23 |
| `validaciones.ts` | `validarTasa`, `validarDiasCiclo`, `validarMaxMeses`, `validarNumeroCuotas`, `validarPrecios`, `validarModalidad` | n/a | T6, T7, T25, T26 |

Cada función lleva un comentario de una línea con su rutina y su fórmula. El motor nunca lee el reloj: toda fecha entra como parámetro.

## 6. Motor: contratos

### 6.1 Reglas comunes

- **Dinero y tasas:** entran como `string | Decimal`. `aDec` lanza `ErrorFinanciero('ENTRADA_NO_DECIMAL')` si recibe `number`.
- **Enteros:** días, plazos y `n` son `number` y se valida `Number.isInteger`.
- **Fechas:** texto `AAAA-MM-DD`.
- **Salidas:** `Dec`. La presentación usa `soles(x) = x.toFixed(2)`.
- **Errores:** una entrada inválida lanza `ErrorFinanciero`. Los dos rechazos de negocio, límite y pago, devuelven resultado con `mensaje` porque son escenarios normales que se auditan (T17, Fig. 23, Fig. 35).

### 6.2 Firmas

```ts
// decimal.ts
export const Dec = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
export type Entrada = string | Decimal;
export function aDec(x: Entrada): Decimal;
export function red(x: Entrada): Decimal;      // floor(100x + 0.5) / 100
export function soles(x: Entrada): string;

// calendario.ts
export function fechaOperativaLocal(fecha: string, hora: string): string;
export function diasEntre(desde: string, hasta: string): number; // hasta - desde
export function sumarMeses(fecha: string, k: number): string;    // exige día <= 28

// tasas.ts
export interface TasaPactada {
  tipo: 'EFECTIVA' | 'NOMINAL';
  valor: Entrada;
  plazo: number;
  capitalizacion?: number;     // nominal sin indicar: 1, diaria (6.3c)
}
export function tasaEfectivaDiaria(t: TasaPactada): Decimal;
export function tasaDeDias(ted: Entrada, n: number): Decimal;    // (1 + TED)^n - 1
export function tem(ted: Entrada): Decimal;
export function tea(ted: Entrada): Decimal;
export function cuantizarTasa(x: Entrada, decimales?: number): Decimal; // 15 por defecto

// ciclo.ts
export function asignarCiclo(a: { fechaOperativa: string; diaCorte: number; diaPago: number }):
  { fechaCorte: string; fechaPago: string };

// listado.ts
export function interesCompra(p: Entrada, ted: Entrada, dias: number): Decimal;
export function listadoDePago(a: {
  compras: { ref: string; fechaOperativa: string; capital: Entrada }[];
  cuotas?: { ref: string; capital: Entrada; interes: Entrada; dias: number }[]; // dias: del período (T31)
  fechaPago: string;
  ted: Entrada;
}): {
  items: { orden: number; tipo: 'COMPRA' | 'CUOTA'; ref: string; fecha: string; dias: number;
           capital: Decimal; interes: Decimal; total: Decimal }[];
  totalCapital: Decimal; totalInteres: Decimal; total: Decimal;
};

// pago.ts
export function liquidarAFecha(a: {
  total: Entrada; tedMora: Entrada; fechaPago: string; fechaOperativaPago: string;
}): { diasMora: number; mora: Decimal; totalALaFecha: Decimal };
export function registrarPago(a: {
  total: Entrada; interes: Entrada; capital: Entrada; tedMora: Entrada;
  fechaPago: string; fechaOperativaPago: string; montoPagado: Entrada;
  moneda?: 'PEN' | 'USD';
}): {
  aceptado: boolean; diasMora: number; mora: Decimal; totalALaFecha: Decimal;
  mensaje?: string;
  imputacion?: { mora: Decimal; interes: Decimal; capital: Decimal };
};

// cuotas.ts
export function capitalCapitalizado(p: Entrada, ted: Entrada, g: number): Decimal;
export function cuotaFrancesa(capital: Entrada, ted: Entrada, dias: number[]):
  { cuota: Decimal; sumaFactores: Decimal };
export function planDeCuotas(a: {
  p: Entrada; ted: Entrada; n: number; fechaOperativa: string; fechaPago: string;
}): {
  g: number; capitalCapitalizado: Decimal; interesGracia: Decimal;
  cuotaFija: Decimal; ultimaCuota: Decimal; sumaFactores: Decimal;
  filas: { k: number; vence: string; diasPeriodo: number; T: number; t: number;
           saldoInicial: Decimal; interes: Decimal; amortizacion: Decimal;
           cuota: Decimal; saldoFinal: Decimal }[];
  totalInteresCuotas: Decimal; totalAmortizacion: Decimal; totalCuotas: Decimal;
  interesesTotales: Decimal;
};

// indicadores.ts
export function tirDiaria(p: Entrada, flujos: { monto: Entrada; t: number }[]): Decimal;
export function indicadoresVenta(a: {
  p: Entrada; pContado: Entrada; flujos: { monto: Entrada; t: number }[]; cok: Entrada;
}): {
  tirDiaria: Decimal; tcea: Decimal; tedCok: Decimal;
  valoresActuales: Decimal[];  // redondeados, solo para mostrar
  sumaVa: Decimal;             // Red de la suma sin redondear: 269.81
  van: Decimal;                // Red(-Pc + suma sin redondear): 20.01
};
export function simularVentaEnCuotas(a: {
  p: Entrada; pContado: Entrada; ted: Entrada; n: number; maxMeses: number; cok: Entrada;
  fechaOperativa: string; diaCorte: number; diaPago: number;
}): { ciclo: { fechaCorte: string; fechaPago: string };
      plan: ReturnType<typeof planDeCuotas>;
      indicadores: ReturnType<typeof indicadoresVenta> };

// descuento.ts
export function valorHoy(a: { vn: Entrada; tea: Entrada; td: number }):
  { te: Decimal; d: Decimal; descuento: Decimal; neto: Decimal };
export function efectivaDesdeDescontada(d: Entrada): Decimal;
export function valorPresenteEfectiva(a: { vn: Entrada; tea: Entrada; td: number }):
  { descuento: Decimal; neto: Decimal };
export function valorPresenteSimple(a: { vn: Entrada; tasa: Entrada; td: number }):
  { descuento: Decimal; neto: Decimal };

// comparacion.ts
export function interesSimple(c: Entrada, tasa: Entrada, dias: number): Decimal;
export function montoSimple(c: Entrada, tasa: Entrada, dias: number): Decimal;
export function montoCompuesto(c: Entrada, tea: Entrada, dias: number): Decimal;

// resumen.ts: SU siempre es un dato de entrada (hecho 8c)
export function creditoDisponible(limite: Entrada, su: Entrada): Decimal;
export function evaluarLimite(a: { monto: Entrada; limite: Entrada; su: Entrada; moneda?: 'PEN' | 'USD' }):
  { aceptada: boolean; disponible: Decimal; mensaje?: string };
export function capitalPorCobrar(saldos: Entrada[]): Decimal;
export function usoLimite(su: Entrada, limite: Entrada): Decimal; // porcentaje sin redondear
export function deudaALaFecha(a: {
  total: Entrada; tedMora: Entrada; fechaPago: string; hoy: string; saldoPendiente: Entrada;
}): Decimal;
```

### 6.3 Reglas de cálculo que no se deben alterar

| Regla | Definición | Sustento |
|---|---|---|
| Fecha operativa | `fechaOperativa(instante)` pasa a delegar en `fechaOperativaLocal(fecha, hora)`. Granularidad de segundo: `17:00:00.9` sigue siendo el mismo día | Fig. 25 (hhmmss) |
| Cuantización | `toDecimalPlaces(15, ROUND_HALF_UP)`, una vez, al guardar en `cliente`. `tcea` usa 10 decimales. El COK no se cuantiza porque su TED no se guarda | T9, sección 8 |
| TEM de la compra | `cuantizarTasa(tem(ted guardada))`, igual que hará la API | Sección 8 |
| Ciclo | Con la fecha operativa y normalizando el año. `fechaCorte` siempre es una fecha válida. La Fig. 31 deja el mes 13 solo internamente | T13, hecho 5 |
| Orden del listado | Estable por `fechaOperativa` (la burbuja con `>` es estable). Las cuotas van después: su fecha es el día de pago | Fig. 33, T31 |
| Interés de cuota | Días reales del período, nunca la TEM | 6.3j, Fig. 37, T19, hecho 4 |
| Última cuota | `amortización = saldo`, `cuota = saldo + interés`. Vale también para `n = 1` | Fig. 37 |
| TIR | Bisección en [0, 0.01]. Devuelve el último punto medio cuando `abs(VA − P) < 0.000001` | Fig. 39, hecho 1 |
| TIR, errores | Tope de 200 iteraciones. `TIR_SIN_RAIZ` si `VA(0) < P` o `VA(0.01) > P` | Hecho 1 |
| VAN | Acumula sin redondear y aplica Red al final | Fig. 41, hecho 2 |
| Mora | Si `fechaOperativaPago <= fechaPago`, mora 0. Si no, `Red(T·[(1+TEDm)^dm − 1])` | Fig. 35 |
| Pago exacto | Rechaza también el pago mayor al total | Fig. 35 |
| Límite | Rechaza solo si `monto > disponible`. Igual al disponible se acepta | Fig. 23 |
| Valor presente | `neto = Red(VN / factor)`, `descuento = VN − neto` | T14 |
| Tasa descontada | `descuento = Red(VN·d)`, `neto = VN − descuento` | 6.3l |
| Deuda a la fecha | `T + Red(T·[(1+TEDm)^D − 1]) + S_pend` (mora como hito) | 6.3m |

### 6.4 Validaciones

| Código | Condición | Mensaje |
|---|---|---|
| `ENTRADA_INVALIDA` | Texto que no es decimal con punto, o Decimal no finito | El valor {x} no es válido: use un número decimal con punto, por ejemplo 228.42. |
| `TASA_TIPO` | Tipo fuera de lista | El tipo de tasa debe ser efectiva o nominal. |
| `TASA_VALOR` | Valor ≤ 0 | La tasa debe ser mayor que cero. |
| `TASA_PLAZO` | `p` fuera de lista | El plazo de la tasa debe ser uno de estos días: 1, 15, 30, 60, 90, 120, 180 o 360. |
| `TASA_CAP_LISTA` | `c` fuera de lista | La capitalización debe ser uno de estos días: 1, 15, 30, 60, 90, 120, 180 o 360. |
| `TASA_CAP_MAYOR` | `c > p` | La capitalización no puede ser mayor que el plazo, porque la tasa debe capitalizar al menos una vez en su período. |
| `TASA_CAP_EFECTIVA` | Efectiva con `c` | La capitalización solo se indica cuando la tasa es nominal. |
| `CICLO_DIA` | Día fuera de 1 a 28 | El día de corte y el día de pago deben estar entre 1 y 28 para que existan en todos los meses. |
| `CICLO_DIAS_IGUALES` | Corte = pago | El día de pago debe ser distinto del día de corte para que el cliente tenga tiempo de pagar. |
| `MAX_MESES` | Fuera de 1 a 12 | El máximo de meses debe estar entre 1 y 12. |
| `CUOTAS_RANGO` | `n` fuera de 1 a máximo | El número de cuotas debe estar entre 1 y {max}, el máximo pactado con el cliente. |
| `PRECIO_CONTADO` | Contado ≤ 0 | El precio contado debe ser mayor que cero. |
| `PRECIO_LISTA` | Lista < contado | El precio de lista debe ser mayor o igual que el precio contado. |
| `MODALIDAD` | Producto no la admite | La modalidad elegida debe estar permitida en todos los productos de la compra. |
| `FECHA_ORDEN` | Compra posterior a la fecha de pago | La fecha de la compra no puede ser posterior a su fecha de pago. |
| `TIR_SIN_RAIZ` | Sin cambio de signo | No se puede calcular la TIR: no hay una tasa diaria entre 0 % y 1 % que iguale las cuotas con el monto. |

Rechazos de negocio, con cifras:
- Límite: `Compra rechazada: supera el crédito disponible de S/ 276.38.`
- Pago: `Pago rechazado: debe pagar el total de S/ 228.72. No se aceptan pagos parciales ni mayores.`

Con USD el símbolo es `US$`.

## 7. Pruebas (`packages/finance/test`)

Comparación exacta con `toFixed(2)`, sin tolerancia. Las tasas se comparan a los decimales que imprime el informe.

Todo lo que usa TED corre con `describe.each` en dos variantes: **TED completa** y **TED de 15 decimales**.

| Archivo | Fuente | Casos esperados |
|---|---|---|
| `decimal.test.ts` | 6.3e, Fig. 27 | `red('1.5786')` = 1.58; `red('2.345')` = 2.35; `red('-1.006')` = -1.01 (trunc daría -1.00); `aDec(1.5)` lanza error |
| `calendario.test.ts` (ampliar) | 6.3e, T17, T18 | Días: 15/09→26/09 = 11; 22/08→26/09 = 35; 30/08→26/09 = 27; 26/09→01/10 = 5; 26/10→26/11 = 31; 26/11→26/12 = 30; 28/02/2028→01/03/2028 = 2 |
| | | `sumarMeses`: 26/09 + 3 = 26/12; 26/12/2026 + 1 = 26/01/2027; día 31 lanza error |
| | | `fechaOperativaLocal` a 17:00:00 y 17:00:01; `diasEntre` contra una transcripción de la Fig. 25 |
| `tasas.test.ts` | 6.3c, f, T18 | TED Luis 0.0010326538; TEDm Luis 0.0002647855; TED María 0.0011473720; TED COK 0.0005065770 |
| | | TEM 3.5000000 %; TEA 51.1068657 %; TNA 42 % diaria: TEA 52.1589010 %; 0.42/360 = 0.0011667 |
| | | `i_k` 3.5000000 %, 3.6187530 %, 3.5000000 %. Nominal sin `c` usa `c = 1`. Cuantizada: 15 decimales exactos |
| `ciclo.test.ts` | T13, Fig. 31, hecho 5 | Las 7 compras de la sección 4.4; corte 25 y pago 5 cae al mes siguiente; 31/12 18:00 cambia de año |
| | | **Equivalencia exhaustiva:** cada día de 2027-12-01 a 2029-01-31, horas 09:00:00, 17:00:00, 17:00:01, 23:59:59, y los 756 pares corte/pago, contra la Fig. 31 transcrita en la prueba. Compara `fechaPago` y `fechaCorte` normalizada. Timeout 120 s |
| `juego1.test.ts` | T16 | Factores 0.0367846, 0.0282592, 0.0219111, 0.0135080, 0.0082912 |
| | | Días 35, 27, 21, 13, 8; intereses 1.63, 0.93, 1.40, 0.41, 0.43; totales 45.83, 33.73, 65.22, 30.91, 52.73 |
| | | Listado 223.62, 4.80, 228.42. Entrada desordenada sale ordenada. Interés sin redondear de T-000231: 1.6259 |
| | T17 | T-000301: operativa 21/09, pago 26/10 |
| | | 999.00 con SU 223.62: rechazada, disponible 276.38 |
| | | Pago 26/09 17:00:00: mora 0, total 228.42 |
| | | Pago 26/09 17:30: `dm` 1, mora 0.06, total 228.48 |
| | | Pago 01/10: `dm` 5, mora 0.30, total 228.72; imputación 0.30, 4.80, 223.62, cuya suma es el pago |
| | | Pago de 200.00 y de 228.73 rechazados: el mensaje contiene 228.72 |
| | | Disponible después del pago, SU 21.30: 478.70 |
| | | Valor de hoy 16/09: `td` 10, descuento 2.35, neto 226.07 |
| `juego2.test.ts` | T18 | `g` 11; P' 261.07; suma de factores 2.7995334; R 93.25; T 30, 61, 91; `t` 41, 72, 102 |
| | | Variante de 6.4: `cuotaFrancesa` con 30, 60, 90 da 93.18 |
| | T19 | Las 3 filas completas al céntimo; días 30, 31, 30; totales 18.69, 261.07, 279.76; saldo final 0.00 |
| | T20 | Intereses 21.96 (3.27 + 18.69); TIR 0.0011469966; TCEA 51.09 %; VAN 20.01 |
| | | Mora de la cuota 2 el 30/11: `dm` 4, 0.12, total 93.37; imputación 0.12, 6.40, 86.85 |
| | | Precio contado distinto de lista: la TCEA usa 257.80 y el VAN usa 249.80 |
| | Otros | `n = 1`; `n = 12` con cambio de año; TIR sin raíz lanza error; 2 cuotas con saldo final 0 |
| `indicadores.test.ts` | T22 | VA 91.33, 89.91, 88.56; `sumaVa` 269.81; VAN 20.01; relación `sumaVa / contado` 1.08 |
| | Fig. 41, hecho 2 | Prueba explícita: la suma de los VA redondeados es 269.80 y no se usa |
| | Hecho 1 | La TIR difiere de 0.0011471558 (ancho de intervalo). VAN negativo con COK alto usa piso |
| `descuento.test.ts` | T14, 6.3l | TE 1.0374657 %; `d` 1.0268129 %; filas 2.35/226.07, 2.35/226.07, 2.82/225.60; la inversa recupera TE |
| `comparacion.test.ts` | T15, 6.3a, b | Simple 1.93, 1.11, 1.68, 0.50, 0.52, total 5.74; compuesto total 4.80; 46.13; 45.83 |
| `resumen.test.ts` | 6.3m, C03 | CPC 502.72; uso 49.0 % y 43.0 % a 1 decimal; disponible de Luis al 22/09: 255.08; `deudaALaFecha` con los datos de T17: 228.42 + 0.30 + saldo |
| `validaciones.test.ts` | T6, T7 | Un caso por código de la sección 6.4; el mensaje contiene la regla |
| `semillas.test.ts` | 4.1 | Literales `@ted_*`, `@tem_maria`, `@tcea_maria` iguales al motor. Sin `number` en los montos |

## 8. `db/verificar_semillas.sql`

Se ejecuta aparte con `db/verificar.sh` (`-S db -d VecinoPay -C -b -I -f 65001`):

```
docker compose run --rm --entrypoint /bin/bash db-init /db/verificar.sh
```

Se expone como `npm run db:verificar`.

**Mecánica:** llena `#chequeo(nombre, esperado, obtenido)`, reúne las diferencias con `STRING_AGG` y, si hay alguna, hace `THROW 50010`. Así informa todos los fallos juntos. Solo vale para el estado al 22/09/2026.

| Chequeo | Esperado |
|---|---|
| Filas: usuario, tienda, producto, cliente | 3, 1, 9, 2 |
| Filas: compra, compra_detalle, cuota | 7, 19, 3 |
| Filas: listado_pago, listado_item, pago, auditoria | 1, 5, 0, 9 |
| CPC, suma de `monto_lista` en PENDIENTE (solo este estado, no define SU) | 502.72 |
| SU Luis / uso Luis / disponible Luis | 244.92 / 49.0 / 255.08 |
| SU María / uso María / disponible María | 257.80 / 43.0 / 342.20 |
| Cobro próximo, `total` de listados EMITIDO | 228.42 |
| Intereses del ciclo / cartera en mora (`total` en VENCIDO) | 4.80 / 0.00 |
| VAN acumulado, suma de `compra.van` | 20.01 |
| Listado: capital / suma de `total` de los ítems | 223.62 / 228.42 |
| Cuotas: interés / amortización / monto / saldo final de la 3 | 18.69 / 261.07 / 279.76 / 0.00 |
| Compra de María: intereses totales (`SUM(monto) − monto_lista`) | 21.96 |
| Compras cuyo `monto_lista` difiere de la suma de `subtotal` | 0 |
| Compras cuyo `monto_contado` difiere de la suma de `ROUND(cantidad × precio_contado, 2)` | 0 |
| T-000301: fecha de pago, comparada como `yyyymmdd` / ítems de listado | 20261026 / 0 |
| Auditoría: ALTA con `usuario_id` NULL / RECHAZO con `registro_id` NULL | 1 / 1 |
| Luis: `codigo_activacion` NULL / María: `usuario_id` NULL y código presente | 1 / 1 |
| `nombre_comercial` contiene `NCHAR(241)` (ñ guardada bien) | 1 |
| Giro `Minimarket`, teléfono presente / columna `pago.numero_operacion` (longitud) | 1, 1 / 30 |

**Pruebas negativas (7).** Cada una en su `TRY/CATCH` con transacción propia y `ROLLBACK`. Falla si la operación tiene éxito o si la rechaza una causa distinta de la indicada.
- `UPDATE auditoria` y `DELETE auditoria` (error 50001).
- `compra_detalle` con producto de otra tienda, que se crea dentro de la transacción (error 50002).
- `compra` con cliente de otra tienda (`FK_compra_cliente`).
- `cuota` con `monto` distinto de `interes + amortizacion` (`CK_cuota_monto`).
- Segundo `listado_pago` para el mismo cliente y corte (`UQ_listado_cliente_corte`).
- `listado_item` con la cuota de otro cliente (error 50003).

## 9. Riesgos y supuestos

### 9.1 Para la fase 3 (no bloquean ahora)

1. **Hora de Prisma.** `fecha_hora` guarda hora local de Lima, pero Prisma devolverá un `Date` leído como UTC. Pasarlo a `fechaOperativa(instante)` restaría 5 horas y movería la fecha operativa. Al leer de la BD se usa `fechaOperativaLocal` con las partes UTC del valor.
2. **Las fechas de la demo ya pasaron.** Hoy es 05/11/2026 y las semillas están al 22/09/2026. Un corte que recupere días atrasados generaría listados y vencimientos que rompen D01. La API debe tomar la hora de un reloj inyectable por variable de entorno, nunca desde la pantalla, y el corte solo debe procesar "hoy" sin ponerse al día.
3. **Prisma y triggers.** Si `create` usa `OUTPUT` sin `INTO`, SQL Server lo rechaza en tablas con triggers de inserción (`compra_detalle`, `listado_item`). Hay que probarlo al inicio de la fase 3. Si falla, usar `createMany` o SQL parametrizado, sin quitar los triggers.
4. **`pago.fecha` es `DATE` (T32), pero T6 pide fecha y hora.** Adrián decidió guardar la fecha calendario real, con `dias_mora` y la hora en auditoría. No cambia cifras.
5. **`tienda_id`.** El prompt y la regla del proyecto lo piden en toda tabla de operación, pero T28, T29, T31 y T32 no lo tienen. Gana el informe (hecho 7). La API filtra esas tablas con `JOIN`.
6. **SU.** Adrián decidió: en cuotas, `monto_lista` hasta pagar la cuota 1 y luego `saldo_final` de la última cuota pagada. La fase 3 implementa la regla; el motor sigue recibiendo SU como dato.
7. **Doble cobro.** La Tabla 34 declara 0:N entre compra o cuota y listado_item, así que el esquema no lo impide: el corte debe excluir lo ya listado.
8. **Lo que controla la API (ronda 1 del revisor):** no crear cuotas en compras `FIN_MES` ni cambiar la tienda de un producto ya vendido.
9. **Antes de exponer la API:** usuario de BD distinto de `sa` para que `TRUNCATE` de auditoría no sea posible, publicar SQL Server solo en `127.0.0.1` y rechazar el `JWT_SECRET` por defecto.
10. **Datos de pantalla sin sembrar:** Peluquería Estilo (A03), un usuario INACTIVO (A04), más eventos de auditoría (A05) y pagos anteriores (C07). No son de los juegos de prueba; se resuelven para la demo.
11. **Imágenes Docker:** copiar `package-lock.json` y usar `npm ci`, probándolo antes.

### 9.2 Supuestos sin ejecutar

Este diseño no se ejecutó. Hay que confirmar en el primer arranque: `AT TIME ZONE 'SA Pacific Standard Time'` en SQL Server sobre Linux, `-f 65001` en `sqlcmd` y el `DEFAULT` de `fecha_hora`. Los montos de 4.3 y 4.4 se recalcularon a mano y cuadran; los del informe se tomaron tal cual.

### 9.3 Escalamientos

Ninguno bloqueó las fases 1 y 2. Adrián resolvió el 2026-11-06 los puntos 1 (A), 2 (B) y 3 (B), además de la hora real del pago (A). El estado vigente de cada tema está en `docs/escalaciones.md`; lo de abajo queda como registro de las opciones.

**[RESUELTO: A] 1. Plazo y capitalización de la mora.** T6, 6.1.1 y Fig. 23 piden `pM` y `cM`; T26 no tiene columnas.
- **A:** sin columnas nuevas. D03 los pide, calcula `ted_mora` y los deja en `auditoria.detalle`. No cambia el Word, pero D03 y C08 no pueden volver a mostrarlos.
- **B:** agregar dos columnas a `cliente`. Obliga a cambiar T26 y el diagrama de la Fig. 43.
- **Recomendación:** A. **Bloquea:** D03 en las fases 3 y 4.

**[RESUELTO: B] 2. Pantallas sin columna.** `tienda.giro` y teléfono (A02, A03), `pago.numero_operacion` (D07, C07), aceptación de datos (D03, C02), último acceso (A04), número de cuenta (C04).
- **A:** sin columnas. Aceptación en `auditoria.detalle`; último acceso desde `LOGIN`; número de cuenta derivado de `cliente.id`; `numero_operacion` solo en auditoría. `giro` y teléfono no se guardan, y el gráfico por giro de A02 no se puede construir.
- **B:** agregar `tienda.giro`, `tienda.telefono` y `pago.numero_operacion`. Obliga a cambiar T24, T32 y Fig. 43.
- **Recomendación:** B solo para esas tres columnas y A para lo demás, porque A02 es entregable y sin `giro` no se puede reproducir. **Bloquea:** A02, A03, D07 y C07.

**[RESUELTO: B] 3. Capital pendiente de una compra en cuotas.** 6.3m usa 257.80 (P) al 22/09, antes de la fecha de pago, y la leyenda habla de "saldos de cuotas". No se define el valor posterior.
- **A:** SU = P hasta la fecha de pago del ciclo y luego P', con los saldos del cronograma. El SU de María sube 3.27 el 26/09 sin que ella haga nada, y CPC y disponible cambian.
- **B:** SU = P hasta pagar la cuota 1 y luego `saldo_final` de la última cuota pagada. No hay saltos sin un hecho que los cause.
- **Recomendación:** B. **Bloquea:** el cálculo de SU en la fase 3, y con él D01, D03, D04, C03 y el rechazo por límite.

**[ESCALAR] 4. Una persona en dos tiendas.** 6.1.1 y la explicación de T26 dicen que el mismo DNI puede tener cuenta en dos negocios. T23 hace único el `username` (el DNI) en toda la plataforma y T34 fija usuario → cliente en 1:1. Con ese modelo no se puede activar la segunda cuenta.
- **A:** mantener T23 y T34. La segunda activación se rechaza con un mensaje; se registra como limitación. No cambia el Word salvo por una aclaración opcional en 6.1.1.
- **B:** un usuario con varios clientes, con `UX (tienda_id, usuario_id)` y selector de tienda en C01. Obliga a cambiar T34 y C01 a C03.
- **Recomendación:** A, porque los juegos de prueba no lo tocan. **Bloquea:** solo C02 en ese caso límite. El esquema de la sección 3 implementa A.

**[ESCALAR] 5. Erratas del Word.** El sistema ya sigue la regla correcta; solo falta decidir si se corrige el documento.
- Nota de T20: los VA redondeados suman 20.00, no 20.01. En 6.4, T22 y sección 7, 269.81 es Red de la suma sin redondear, no la suma de las filas mostradas.
- Fig. 27 usa `trunc`; 6.3e usa piso.
- T29 dice "saldo inicial por la TEM"; 6.3j y T19 usan días reales.
- **A:** corregir las tres en el Word. **B:** dejarlas y explicarlas en la sustentación.
- **Recomendación:** A, porque son cambios de una línea. **Bloquea:** nada. D05 debe mostrar 269.81 como total calculado, sin sumar filas.
