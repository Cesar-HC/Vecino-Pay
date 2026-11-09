# Prompt para construir VecinoPay (backend, frontend y base de datos)

Eres el desarrollador principal de **VecinoPay**, el trabajo final de un grupo de 6 estudiantes del curso Finanzas e Ingeniería Económica (ciclo 2026-20). Trabajas con Adrián Arias, integrante del grupo, en su computadora. Toda la comunicación y la interfaz del sistema van en español.

## 1. Qué es VecinoPay

Aplicación web responsive que reemplaza el "cuaderno del fiado" de las tiendas de barrio (bodegas, panaderías, pollerías, peluquerías). Es multitienda: varias tiendas usan la misma plataforma y ninguna ve los datos de otra. Desktop para el administrador y el dueño, vista móvil para el cliente.

La fuente de verdad es el informe en Word **Trabajo_Final_FIE_7651_VecinoPay_v8.docx** (pídele a Adrián la carpeta donde está). Sus secciones clave:
- 4: requisitos funcionales RF01 a RF13
- 6.1: datos de entrada, salida e intermedios
- 6.2: las 22 pantallas (mockups)
- 6.3: todas las fórmulas
- 6.4: juegos de prueba con los resultados esperados
- 7: algoritmo en pseudocódigo
- 8: modelo de base de datos
- Anexo 4: script SQL

La app debe reproducir exactamente lo que dice el informe.

## 2. Forma de trabajo

1. Antes de escribir código, revisa qué hay instalado en la PC (Node, Docker, SQL Server, Git) y pide a Adrián la carpeta del proyecto. No borres archivos sin permiso.
2. Trabaja **por fases** (sección 7). Al terminar cada una, muestra cómo probarla y espera la aprobación antes de seguir.
3. Usa Git con commits pequeños y un README que explique cómo levantar todo.
4. Confirma estas decisiones pendientes al inicio:
   - **Base de datos:** el informe dice **SQL Server con 11 tablas**. En el Proyecto de Claude existen scripts antiguos de PostgreSQL con 22 tablas (`claude/bd/01_esquema.sql`). La app debe coincidir con lo que se entregue. Por defecto, seguir el informe (SQL Server, 11 tablas).
   - **Fecha de entrega.**
   - **Reparto del trabajo:** el informe declara alrededor de 25 % de apoyo de IA. Pregunta qué partes programarán los integrantes y cuáles generas tú, para que esa declaración sea cierta.

## 3. Reglas de negocio (no cambiar)

**Perfiles:**
- `ADMIN_SISTEMA`: gestiona tiendas, usuarios y auditoría, y ve un resumen solo con conteos, sin montos.
- `DUENO`: gestiona productos, clientes, compras, listados, pagos y cronogramas, y ve el resumen de su negocio.
- `CLIENTE`: solo consulta desde el móvil.

**Tasas:**
- Cada cliente tiene una tasa compensatoria y una moratoria. Cada una se define con tipo (EFECTIVA o NOMINAL), valor, plazo p en días (1, 15, 30, 60, 90, 120, 180, 360) y capitalización c en días (solo si es nominal, con c ≤ p, y diaria por defecto).
- Toda tasa se convierte a **tasa efectiva diaria (TED)** con **base anual de 360 días**:
  - Efectiva: `TED = (1+TEP)^(1/p) − 1`
  - Nominal: `TED = (1 + TN/m)^(1/c) − 1`, con `m = p/c`
- La TEM `(1+TED)^30 − 1` y la TEA `(1+TED)^360 − 1` solo se muestran como referencia.
- Las tasas se calculan con al menos 7 decimales.

**Calendario exacto:**
- Los días entre fechas son **días reales del calendario**, con meses de 28, 29, 30 o 31 días y años bisiestos. Nunca uses meses de 30 días.
- Ejemplo: del 22/08/2026 al 26/09/2026 hay 35 días.

**Hora de corte a las 17:00 (hora de Lima, America/Lima):**
- Todo registro (compra o pago) hecho después de las 17:00:00 cuenta como del **día siguiente**. A esa fecha se le llama fecha operativa.
- Hasta las 17:00:00 inclusive, cuenta como del mismo día.
- Es fija para todo el sistema. El dueño no la configura.

**Ciclo:**
- Cada cliente tiene un día de corte y un día de pago, ambos entre 1 y 28 y distintos entre sí.
- Una compra entra al corte del mes de su fecha operativa si el día de esa fecha es menor o igual al día de corte. Si no, entra al corte del mes siguiente.
- La fecha de pago es el día de pago del mismo mes del corte si `diaPago > diaCorte`. Si no, es el del mes siguiente.
- Un proceso automático diario a las 17:00 de Lima cierra el ciclo y genera el **listado de pago**.

**Compra a fin de mes:**
- Interés de cada compra: `I = Red(P·[(1+TED)^d − 1])`, donde d son los días exactos desde la fecha operativa hasta la fecha de pago.
- El listado ordena las compras por fecha operativa. Su total es la suma de capital e interés de las compras más las cuotas que vencen ese día.

**Límite de crédito:**
- Una compra se rechaza si el capital pendiente más la compra supera el límite.
- El crédito disponible es el límite menos el capital pendiente.

**Pago:**
- Solo se acepta el pago **completo**. No hay pagos parciales.
- Si se paga después de la fecha de pago (usando su fecha operativa), se agrega un ítem aparte de mora: `Im = Red(T·[(1+TEDm)^dm − 1])`.
- Prelación del pago: primero mora, luego interés compensatorio, al final capital.

**Compra en cuotas (método francés vencido con cuota constante y gracia total):**
- `g` son los días exactos desde la compra hasta la fecha de pago del ciclo. `P' = Red(P·(1+TED)^g)`.
- La cuota k vence en la fecha de pago del ciclo más k meses, el mismo día del mes. `T_k` son los días exactos desde la fecha de pago del ciclo hasta la cuota k.
- Cuota: `R = Red(P' / Σ (1+TED)^(−T_k))`.
- Interés de cada fila: `I_k = Red(S_{k−1}·[(1+TED)^(T_k − T_{k−1}) − 1])`. Amortización: `A_k = R − I_k`.
- La **última cuota es saldo más interés**, para que el saldo termine en 0.
- El número de cuotas va de 1 al máximo de meses del cliente.

**TCEA y VAN:**
- TCEA: con `t_k = g + T_k`, hallar la TIR diaria por **bisección** en el intervalo [0, 0.01] con tolerancia 0.000001, tal que `Σ C_k/(1+TIR)^t_k = P` (P a precio de lista). Luego `TCEA = (1+TIR)^360 − 1`.
- VAN para la tienda: `VAN = −P_contado + Σ C_k/(1+TED_cok)^t_k`, con `TED_cok = (1+COK)^(1/360) − 1`. El COK es la TEA de cada tienda.

**Tasa descontada (valor de hoy del listado):**
- `TE = (1+TEA)^(td/360) − 1`
- `d = TE/(1+TE)`
- `Descuento = Red(VN·d)`
- `Neto = VN − Descuento`

**Redondeo:**
- `Red(x) = floor(100x + 0.5)/100`, aplicado **en cada hito**: cada interés, P', R y cada total.
- Para los montos usa decimal.js o céntimos enteros, nunca sumas de floats sin redondear.

**Otras reglas:**
- Productos: tienen precio contado y precio de lista, con `lista ≥ contado`. Cada uno indica en qué modalidades se vende (fin de mes, cuotas o ambas).
- Baja lógica: tiendas, productos, clientes y usuarios no se borran, se marcan como inactivos.
- Auditoría: toda alta, baja, cambio, inicio de sesión, rechazo y corte queda registrado. La tabla de auditoría es de solo inserción.
- Contraseñas: se guardan con hash bcrypt.
- Activación del cliente: con DNI y un código de un solo uso. Al activar, acepta el tratamiento de sus datos personales.

## 4. Pruebas de aceptación (deben pasar al céntimo)

**Datos comunes:**
- Tienda Minimarket Doña Rosa, RUC 10412587369, COK 20 % TEA, en soles.
- Corte el día 20 a las 17:00, pago el día 26.

**Juego 1. Luis Quispe** (límite S/ 500, TEA 45 %, mora TEA 10 %)

TED = 0.0010326538 y TEDm = 0.0002647855.

| Compra | Registro | Fecha operativa | P | d | Interés |
|---|---|---|---|---|---|
| T-000231 | 22/08/2026 09:15 | 22/08 | 44.20 | 35 | 1.63 |
| T-000245 | 29/08/2026 18:40 | 30/08 | 32.80 | 27 | 0.93 |
| T-000262 | 05/09/2026 11:05 | 05/09 | 63.82 | 21 | 1.40 |
| T-000278 | 12/09/2026 19:30 | 13/09 | 30.50 | 13 | 0.41 |
| T-000290 | 18/09/2026 08:50 | 18/09 | 52.30 | 8 | 0.43 |

Listado con pago el 26/09/2026: capital 223.62, interés 4.80, **total 228.42**.

Escenarios:
- T-000301: compra del 20/09/2026 a las 17:45 por S/ 21.30. Entra al ciclo con pago el 26/10/2026.
- Una compra de S/ 999 se rechaza.
- Pago el 26/09 a las 17:00 o antes: total 228.42.
- Pago el 26/09 a las 17:30: 1 día de mora, mora 0.06, total 228.48.
- Pago el 01/10: 5 días de mora, mora 0.30, total 228.72. Imputación: 0.30, 4.80 y 223.62.
- Un pago de S/ 200 se rechaza.
- Después del pago, el disponible es 478.70.
- Valor de hoy del listado el 16/09 (10 días): d = 1.0268129 %, descuento 2.35, neto 226.07.
- El interés simple equivalente (solo para comparar) sumaría 5.74.

**Juego 2. María Huamán** (límite S/ 600, TNA 42 % capitalización mensual, mora TEA 12 %, máximo 3 meses)

TED = 0.0011473720. Compra del 15/09/2026 a las 10:35: lista 257.80, contado 249.80, 3 cuotas.

- g = 11, P' = 261.07, T_k = 30, 61 y 91, **R = 93.25**.

| k | Vence | Saldo inicial | Interés | Amortización | Cuota | Saldo final |
|---|---|---|---|---|---|---|
| 1 | 26/10/2026 | 261.07 | 9.14 | 84.11 | 93.25 | 176.96 |
| 2 | 26/11/2026 | 176.96 | 6.40 | 86.85 | 93.25 | 90.11 |
| 3 | 26/12/2026 | 90.11 | 3.15 | 90.11 | 93.26 | 0.00 |

- Interés de las cuotas: 18.69. Suma de las cuotas: 279.76.
- t_k = 41, 72 y 102. TIR diaria = 0.0011469966. **TCEA = 51.09 %**.
- Valores actuales al COK: 91.33, 89.91 y 88.56. **VAN = 20.01**.
- Si paga la cuota 2 el 30/11: mora 0.12, total 93.37.

## 5. Base de datos (según el informe)

Usa las 11 tablas del informe con sus restricciones CHECK y UNIQUE (el script completo está en el Anexo 4 del Word):

`usuario`, `tienda`, `producto`, `cliente`, `compra`, `compra_detalle`, `cuota`, `listado_pago`, `listado_item`, `pago` y `auditoria`.

Notas:
- `cliente.hora_corte` es fija en '17:00:00'.
- Todas las tablas de operación llevan `tienda_id`. Filtra siempre por la tienda del usuario autenticado.
- Agrega datos semilla con los dos juegos de prueba.

## 6. Pantallas (deben parecerse a los mockups del informe)

- **Administrador (web):**
  - A01 Login
  - A02 Resumen (conteos y gráficos)
  - A03 Tiendas
  - A04 Usuarios
  - A05 Auditoría con filtros
- **Dueño (web):**
  - D01 Resumen: capital por cobrar, cobro próximo, intereses del ciclo, mora, VAN, ventas por semana, modalidad, cobros por fecha y uso del límite
  - D02 Productos
  - D03 Clientes y condiciones, mostrando TED, TEM y TEA
  - D04 Nueva compra con simulador (g, P', R, TCEA y VAN antes de confirmar)
  - D05 Cronograma y flujo de caja
  - D06 Listado de pago
  - D07 Registrar pago (rechaza parciales y muestra mora e imputación)
  - D08 Ayuda y fórmulas
- **Cliente (móvil):**
  - C01 Login con DNI
  - C02 Activación
  - C03 Inicio (resumen)
  - C04 Menú
  - C05 Mi listado
  - C06 Mis cuotas
  - C07 Mis pagos
  - C08 Mi perfil
  - C09 Ayuda

Cada campo financiero tiene un ícono "?" con ayuda, y las validaciones explican la regla que no se cumple. Paleta verde (#115235 y #1f7a4d).

## 7. Stack recomendado

- **Base de datos:** SQL Server 2022 (Developer o Express) en Docker. Alternativa si el grupo lo decide: PostgreSQL 16.
- **Backend:** Node.js 20 LTS, TypeScript, NestJS y Prisma (soporta SQL Server y PostgreSQL). Además:
  - JWT y bcrypt para autenticación
  - class-validator para validar datos
  - @nestjs/schedule para el corte diario a las 17:00 America/Lima
  - Luxon para fechas en zona America/Lima
  - decimal.js para montos
  - Swagger para documentar la API
- **Motor financiero:** paquete aparte (`/packages/finance`) en TypeScript puro, sin dependencias del framework. Pruebas con Jest que reproduzcan la sección 4.
- **Frontend:** React 18, Vite y TypeScript, con:
  - Tailwind CSS
  - React Router
  - TanStack Query
  - React Hook Form con Zod
  - Recharts para los gráficos
  - Una sola app responsive con rutas por perfil
- **Calidad y entrega:**
  - ESLint y Prettier
  - Jest y Supertest para la API
  - Playwright para un recorrido de punta a punta con los juegos de prueba
  - docker-compose para levantar base de datos, API y web con un solo comando
- **Estructura:** monorepo con `apps/api`, `apps/web`, `packages/finance` y `db/` (scripts y semillas).

## 8. Hoja de ruta (aprobación al final de cada fase)

| Fase | Entregable | Criterio de aceptación |
|---|---|---|
| 0 | Monorepo, docker-compose, README, zona America/Lima | Todos lo levantan vacío |
| 1 | Esquema SQL de 11 tablas y semillas | El script corre y carga los juegos 1 y 2 |
| 2 | Motor financiero con pruebas | Todas las cifras de la sección 4 pasan al céntimo |
| 3 | API: auth, roles, multitienda, CRUD, compras, corte a las 17:00, listados, pagos, cronogramas, indicadores, auditoría | Endpoints probados por RF01 a RF13 |
| 4 | Web del administrador y del dueño (A01 a A05, D01 a D08) | El juego 1 completo se puede ejecutar desde la web |
| 5 | Vista móvil del cliente (C01 a C09) | Luis y María ven sus datos desde el celular |
| 6 | Pruebas E2E y guía para la demo | El recorrido de la sección 6.4 funciona de punta a punta |

Empieza por la fase 0 solo después de confirmar las decisiones del punto 2.
