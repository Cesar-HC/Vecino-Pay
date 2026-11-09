# Diseño de la fase 5: vista móvil del cliente (C01 a C09)

Fuentes, en orden de jerarquía: `docs/informe_v8.txt`, `docs/prompt_desarrollo.md`, `CLAUDE.md`.
Figuras de referencia: `docs/mockups/fig14*` a `fig22*`.

## 1. Resumen
1. **API ya completa:** Los endpoints de `/api/mi/*` y `/api/auth/activar` ya están implementados, probados con aislamiento multitienda y validados en `apps/api/src/mi/mi.ts`. No se requieren cambios en la base de datos ni en el backend.
2. **Web:** Implementación de las 9 pantallas móviles (C01 a C09) en `apps/web/src/pantallas/cliente/` con diseño responsive optimizado para celulares (máximo 480px centrado en pantallas grandes), paleta verde institucional (`#115235` y `#1f7a4d`), fuentes legibles e íconos de ayuda `?`.
3. **Plantilla móvil:** `PlantillaCliente.tsx` con franja de reloj para demostración, encabezado con nombre de tienda y cuenta, y barra de navegación inferior fija con acceso directo a Inicio (C03), Mi listado (C05), Mis cuotas (C06) y Menú/Más (C04).
4. **Validaciones y estado:** Uso de React Hook Form con Zod en login, activación y cambio de contraseña. Manejo de sesiones en `sessionStorage` mediante `useSesion`.
5. **Pruebas:** Pruebas unitarias y de renderizado en `apps/web/src/pruebas/cliente.test.tsx` que verifiquen las cifras de Luis Quispe (Juego 1) y María Huamán (Juego 2).

---

## 2. Lista de archivos y responsabilidad

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `apps/web/src/api/tipos.ts` | Modificar | Tipos TypeScript de respuestas de `/api/mi/*`, activación y perfil de cliente. |
| `apps/web/src/api/api.ts` | Modificar | Métodos para consumir `/api/mi/resumen`, `/cuotas`, `/listados`, `/pagos`, `/perfil`, `/ayuda/ejemplo` y `/auth/activar`. |
| `apps/web/src/plantillas/PlantillaCliente.tsx` | Crear | Layout móvil con franja de demostración, cabecera de cuenta y barra inferior de navegación (Bottom Nav). |
| `apps/web/src/pantallas/cliente/C01LoginCliente.tsx` | Crear | Pantalla C01: Login móvil con DNI y contraseña. Enlaces a activación y recuperación. |
| `apps/web/src/pantallas/cliente/C02Activar.tsx` | Crear | Pantalla C02: Activación de cuenta con DNI, código de tienda, celular, claves y check de consentimiento. |
| `apps/web/src/pantallas/cliente/C03InicioCliente.tsx` | Crear | Pantalla C03: Tablero móvil con total a pagar, días restantes, crédito disponible, compras por semana y tasa. |
| `apps/web/src/pantallas/cliente/C04MenuCliente.tsx` | Crear | Pantalla C04: Menú principal del cliente con accesos, datos de versión y botón de cerrar sesión. |
| `apps/web/src/pantallas/cliente/C05MiListado.tsx` | Crear | Pantalla C05: Desglose de compras del ciclo en 2 líneas, corte 17:00 (`*`), total a pagar y aviso de mora. |
| `apps/web/src/pantallas/cliente/C06MisCuotas.tsx` | Crear | Pantalla C06: Cronograma de cuotas, TCEA, próxima cuota y tarjeta pedagógica de periodo de gracia. |
| `apps/web/src/pantallas/cliente/C07MisPagos.tsx` | Crear | Pantalla C07: Historial de pagos, detalle del último pago con imputación (mora → interés → capital) y disponible. |
| `apps/web/src/pantallas/cliente/C08MiPerfil.tsx` | Crear | Pantalla C08: Consulta de condiciones de crédito (TEA, mora, corte, límite) y cambio de contraseña. |
| `apps/web/src/pantallas/cliente/C09AyudaCliente.tsx` | Crear | Pantalla C09: Explicación de la fórmula con compra real (`/api/mi/ayuda/ejemplo`), glosario y temas frecuentes. |
| `apps/web/src/App.tsx` | Modificar | Registrar rutas `/m/*` con guarda `CLIENTE`, y `/m/login`, `/m/activar`. |
| `apps/web/src/pruebas/cliente.test.tsx` | Crear | Pruebas de navegación, formularios y datos de los juegos de prueba en vitest. |

---

## 3. Contratos de Datos (Frontend <-> Backend)

### Resumen del Cliente (`GET /api/mi/resumen`)
- `cliente`: `{ nombre: string, numeroCuenta: string }`
- `tienda`: `{ nombreComercial: string }`
- `moneda`: `'PEN'`
- `proximoPago`: `{ total: string, capital: string, interes: string, mora: string, totalALaFecha: string, fecha: string, diasRestantes: number, proyectado: boolean } | null`
- `credito`: `{ limite: string, usado: string, disponible: string, usoPorcentaje: string }`
- `comprasPorSemana`: `Array<{ semana: string, monto: string }>`
- `comprasDelCiclo`: `number`
- `tasa`: `{ tipo: string, valor: string, plazo: number | null, capitalizacion: string | null }`

### Cuotas del Cliente (`GET /api/mi/cuotas`)
- `compras`: `Array<{ ticket: string, cuotaFija: string | null, tceaPorcentaje: string | null, proximaCuota: { numero: number, vence: string, monto: string } | null, filas: Array<{ numero: number, vence: string, monto: string, estado: string }>, explicacion: { fechaCompra: string, fechaPago: string, g: number, interesGracia: string, montoLista: string, capitalCapitalizado: string } }>`

### Activación de Cuenta (`POST /api/auth/activar`)
- Entrada: `{ dni: string (8 dígitos), codigo: string, celular: string, password: string, passwordConfirmacion: string, aceptaDatos: boolean }`
- Salida (200): `{ token: string, usuario: ..., tienda: ... }`

---

## 4. Riesgos y Supuestos
- **Pantalla pequeña:** La vista móvil debe caber cómodamente en anchos de 360px a 420px sin desbordamiento horizontal.
- **Reloj fijo en demo:** Al igual que en las pantallas del dueño, debe visualizarse la franja informativa de hora fija de Lima.
- **Sin datos confidenciales:** Las pantallas de cliente nunca deben mostrar ni calcular VAN, COK de la tienda ni precio al contado (cumpliendo estrictamente el RF09).
