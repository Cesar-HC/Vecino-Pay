# VecinoPay: instrucciones para Claude Code

Trabajo final de FIE 7651 (ciclo 2026-20). Toda la comunicación y la interfaz van en español.
Fuentes de verdad: `docs/informe_v8.txt` (texto del informe v8) y `docs/prompt_desarrollo.md`.

## Decisiones ya tomadas (no volver a preguntar)
- Base de datos: **SQL Server 2022 con las 11 tablas del informe** (sección 8). Los scripts antiguos de PostgreSQL con 22 tablas no se usan.
- Todo el código lo genera Claude. La sección 9 del informe debe declararlo (pendiente del grupo).
- Entrega en **una semana o menos** desde el 05/11/2026. Se prioriza tener el juego 1 y el juego 2 funcionando de punta a punta.
- Node 22 (mínimo 20), Docker Desktop con WSL 2 en Windows.
- Se trabaja por fases (README). Al final de cada fase, Adrián aprueba antes de seguir.

## Equipo de agentes y flujo obligatorio
Para cada fase o cambio relevante, la sesión principal coordina este ciclo:

1. **arquitecto** → diseña y deja `docs/diseno/<tema>.md`.
2. **Sesión principal** → implementa según el diseño.
3. **revisor** → revisa el diff y corre las pruebas.
4. **auditor** → verifica contra el informe (cifras al céntimo, RF, tablas y pantallas).
5. Si el revisor o el auditor piden cambios, la sesión principal los corrige y vuelve al paso 3.
6. Con APROBADO y CONFORME → commit pequeño y se reporta a Adrián cómo probar la fase.

### Resolución de discusiones entre agentes (sin humano)
Cuando el arquitecto, el revisor y el auditor no coinciden, la sesión principal resuelve sola con esta jerarquía:
1. Lo que dice el **informe v8** (manda siempre).
2. Las reglas del `docs/prompt_desarrollo.md`.
3. Las decisiones de este archivo.
4. El criterio técnico más simple que pase las pruebas.

Se permiten como máximo **2 rondas** de ida y vuelta por discusión. Cada resolución se anota en una línea en `docs/decisiones.md` (fecha, tema, decisión, quién tenía razón y por qué).

### Escalamiento a Adrián (solo en estos casos)
Se detiene el trabajo y se le pregunta a Adrián **únicamente** si:
- El informe no define la regla y la decisión cambia una cifra, una pantalla o un RF entregable.
- El informe tiene un error o dos secciones se contradicen, y corregirlo obliga a cambiar el Word.
- Hay que cambiar el alcance, el stack, el modelo de 11 tablas o el plazo.
- La acción es irreversible: borrar archivos, reescribir el historial de Git o publicar algo.
- Tras 2 rondas no hay acuerdo y la jerarquía de arriba no decide.

Formato del escalamiento (breve): **tema**, **opciones (A/B)** con su consecuencia, **recomendación** y qué queda bloqueado. Se registra también en `docs/escalaciones.md`.

Todo lo demás (nombres, estructura interna, librerías menores, refactors, estilo) lo resuelven los agentes sin preguntar.

## Reglas técnicas
- Montos con decimal.js; `Red(x) = floor(100x + 0.5)/100` en cada hito.
- Fechas: calendario exacto, zona America/Lima, hora de corte fija 17:00:00 inclusive.
- Toda consulta de operación filtra por el `tienda_id` del usuario autenticado.
- Commits pequeños, en español, con prefijo de fase: `fase-1: ...`.
- No borrar archivos de Adrián sin permiso.

## Comandos
- `docker compose up -d --build`: levanta todo (web :8080, API :3000, SQL Server :1433).
- `npm install` y luego `npm test`: pruebas del motor financiero.
- `npm run dev:api` y `npm run dev:web`: desarrollo local.
