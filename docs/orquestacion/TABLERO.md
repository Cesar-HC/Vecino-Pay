# Tablero de Orquestación: Antigravity + Claude Code
**Proyecto:** VecinoPay  
**Fase actual:** Fase 5 — Vista móvil del cliente (C01 a C09)  
**Fuente de verdad:** `docs/informe_v8.txt`, `CLAUDE.md`, `docs/mockups/`

---

## 1. Reparto de Responsabilidades

| Agente | Rol principal | Espacio de trabajo / Rama | Responsabilidad |
|---|---|---|---|
| **Antigravity** | **Backend, Arquitecto & Auditor** | `VecinoPay` (`fase-5/api`) | Endpoints NestJS (`apps/api`), motor financiero (`packages/finance`), auditoría al céntimo y tests unitarios/integración. |
| **Claude Code** | **Frontend UI & Mobile Specialist** | `VecinoPay-claude` (`fase-5/web`) | Vistas móviles React + Tailwind (`apps/web/src/pantallas/cliente/`), navegación, formularios y responsive según mockups C01–C09. |

---

## 2. Contratos de la API para la Fase 5 (Definidos por Antigravity para Claude)

> **Corrección (2026-11-08):** los endpoints `/api/cliente/*` de esta lista no existen. La API real, ya implementada y probada en la fase 3, es `/api/mi/*` (resumen, listados, cuotas, pagos, perfil, ayuda/ejemplo) más `/api/auth/login`, `/api/auth/activar` y `/api/auth/cambiar-contrasena`. Ver `docs/diseno/fase-5.md`.

1. `POST /api/cliente/login`: Recibe `{ dni, password }`. Retorna `{ token, cliente }`.
2. `POST /api/cliente/activar`: Recibe `{ dni, codigo_activacion, password }`. (Semilla: María Huamán DNI `40000002`, código `MDR-7K2Q`).
3. `GET /api/cliente/resumen`: Retorna saldo pendiente, próximo vencimiento, disponible y estado de mora.
4. `GET /api/cliente/listado`: Retorna el listado de compras del ciclo actual con desglose de interés, mora y fecha de corte.
5. `GET /api/cliente/cuotas`: Retorna el cronograma de cuotas (Juego 2: cuotas 1, 2, 3 con R = 93.25 / 93.26).
6. `GET /api/cliente/pagos`: Historial de pagos realizados y su imputación (mora → interés → capital).
7. `GET /api/cliente/perfil`: Datos personales, TEA/TNA, límite de crédito y hora de corte (17:00).

---

## 3. Estado de Tareas (Fase 5)

### Módulo de Arquitectura y Contratos
- [x] **A01:** Diseño técnico y especificación en `docs/diseno/fase-5.md`. *(Completado)*
- [ ] **A02:** Extensión de tipos de API en `apps/web/src/api/tipos.ts` y métodos en `api.ts`. *(En progreso)*

### Módulo Frontend Móvil (Vistas C01 a C09)
- [ ] **C00:** Plantilla móvil (`PlantillaCliente.tsx`) con Bottom Navigation y FranjaReloj. *(Pendiente)*
- [ ] **C01:** Pantalla de Login móvil con DNI (`C01LoginCliente.tsx`). *(Pendiente)*
- [ ] **C02:** Pantalla de Activación de cuenta (`C02Activar.tsx`). *(Pendiente)*
- [ ] **C03:** Dashboard de Inicio móvil con resumen y deuda (`C03InicioCliente.tsx`). *(Pendiente)*
- [ ] **C04:** Menú del cliente (`C04MenuCliente.tsx`). *(Pendiente)*
- [ ] **C05:** Mi Listado de Pago con desglose de compras (`C05MiListado.tsx`). *(Pendiente)*
- [ ] **C06:** Mis Cuotas con cronograma y explicación de gracia (`C06MisCuotas.tsx`). *(Pendiente)*
- [ ] **C07:** Mis Pagos con recibo e imputación de mora (`C07MisPagos.tsx`). *(Pendiente)*
- [ ] **C08:** Mi Perfil y cambio de contraseña (`C08MiPerfil.tsx`). *(Pendiente)*
- [ ] **C09:** Ayuda móvil con compra real pedagógica (`C09AyudaCliente.tsx`). *(Pendiente)*

### Módulo de Pruebas y Auditoría
- [ ] **T01:** Rutas registradas en `App.tsx` bajo `/m/*`. *(Pendiente)*
- [ ] **T02:** Pruebas Vitest en `apps/web/src/pruebas/cliente.test.tsx`. *(Pendiente)*
- [ ] **T03:** Auditoría de cifras de Luis Quispe y María Huamán. *(Pendiente)*

---

## 4. Protocolo de Sincronización y Merge
1. Cada agente finaliza su grupo de tareas con sus respectivas pruebas en verde (`npm test:api` o `npm test:web`).
2. Antigravity audita que las pantallas reflejen las cifras de los Juegos 1 y 2 según `docs/informe_v8.txt`.
3. Se integran ambas ramas a `master` mediante:
   ```bash
   git merge fase-5/api
   git merge fase-5/web
   ```
4. Se presenta a Adrián para aprobación final de la fase.
