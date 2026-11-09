# Diseño: landing en "/" e ingreso único (apps/web)

Alcance: solo frontend. La API, `LoginDto` (exige `perfil`), las reglas financieras y las 11 tablas no cambian.
Fuentes: informe v8 sección 4 (RF de acceso y perfiles), 6.2 (A01 y C01, C02), prompt_desarrollo.md (multitienda, alta de tiendas por el administrador y de clientes por el dueño).

## 1. Resumen
- "/" deja de ser solo una redirección: sin sesión muestra una landing; con sesión redirige a `inicioDe(perfil)` igual que hoy.
- Un único componente de ingreso (`Ingreso`) con selector "Soy cliente / Soy dueño". Cliente: DNI + contraseña, `perfil: 'CLIENTE'`. Comercio: usuario + contraseña + select "Perfil" (Administrador del negocio = DUENO, Administrador del sistema = ADMIN_SISTEMA).
- `/login`, `/m/login` e `/ingresar` (nueva) montan el mismo componente; solo cambia el modo inicial.
- No hay registro abierto: el cliente solo activa su cuenta en `/m/activar` (C02) con DNI + código del dueño.
- Pantalla extra fuera de las 22 del informe: anotar en `docs/decisiones.md` ("L01 Landing" e "ingreso único que unifica A01 y C01, sin cambio de RF"). Las pantallas A01 y C01 siguen existiendo como los dos formularios del ingreso.

## 2. Decisión: cómo resolver comercio = DUENO o ADMIN_SISTEMA sin tocar el backend
Opción elegida: **conservar el select "Perfil"** (hoy ya existe en A01) visible solo en el modo comercio, con DUENO por defecto.
Justificación:
- Es lo más simple: cero cambios de lógica, el e2e actual de dueño y admin sigue igual (`selectOption({label:'Administrador del sistema'})`).
- Es lo más seguro: el "intento ordenado" (probar DUENO y luego ADMIN_SISTEMA) duplica los intentos fallidos, ensucia la auditoría de inicios de sesión (A05, "cada inicio de sesión queda registrado"), y puede revelar por diferencia de tiempos o mensajes qué perfil existe. El mensaje genérico actual ("Usuario, contraseña o perfil incorrectos.") se conserva.
- Un solo clic extra solo para el administrador del sistema, usuario poco frecuente.

## 3. Archivos
Crear:
- `apps/web/src/pantallas/comun/Landing.tsx`: página pública. Cabecera con marca "VecinoPay" y botón "Ingresar"; héroe (qué es); 3 beneficios; enlace a activar; pie. Sin formularios.
- `apps/web/src/pantallas/comun/Ingreso.tsx`: carcasa del ingreso. Props `{ modoInicial: 'cliente' | 'comercio' }`. Contiene: `FranjaReloj`, redirección si hay sesión (`Navigate` a `inicioDe`), panel de marca, selector de modo, aviso de sesión (`aviso`), franja "Cuenta creada..." (`location.state.activada`), y el formulario según el modo. Enlaces: "¿Primera vez? Activa tu cuenta" (/m/activar) y "Volver al inicio" (/).
- `apps/web/src/pantallas/comun/SelectorModo.tsx` (puede vivir dentro de Ingreso.tsx): dos botones tipo pestaña, `role="tablist"`/`role="tab"` con `aria-selected`, texto "Soy cliente" y "Soy dueño".

Modificar:
- `apps/web/src/pantallas/admin/A01Login.tsx`: pasa a exportar `FormularioComercio` (mismo esquema zod, campos Usuario, Contraseña, Perfil, botón "Ingresar", texto "Cada inicio de sesión queda registrado"). Se quitan la cabecera, el panel oscuro y el enlace "portal móvil" (ahora lo cubre el selector). Se mantiene el default export `A01Login = () => <Ingreso modoInicial="comercio" />` solo si se prefiere conservar imports; recomendado: borrar el default y que App importe `Ingreso`.
- `apps/web/src/pantallas/cliente/C01LoginCliente.tsx`: pasa a exportar `FormularioCliente` (DNI con `inputMode="numeric"`, `maxLength=8`, contraseña, "¿Olvidaste tu contraseña?" con su franja de recuperación, botón "Ingresar"). Se quitan cabecera, pie y enlace "acceso web".
- `apps/web/src/App.tsx`:
  - `/` -> `<Inicio />` que, cargando, muestra `<Cargando />`; con sesión `Navigate` a `inicioDe(perfil)`; sin sesión `<Landing />` (en vez de `Navigate to /login`).
  - `/login` -> `<Ingreso modoInicial="comercio" />`
  - `/m/login` -> `<Ingreso modoInicial="cliente" />`
  - `/ingresar` -> `<Ingreso modoInicial="cliente" />` (ruta que usan la landing y los enlaces nuevos)
  - Sin cambios: `Guarda perfil="CLIENTE" login="/m/login"`, las demás rutas y el comodín.
- `apps/web/src/pantallas/cliente/C02Activar.tsx`: nada obligatorio (sigue enlazando y navegando a `/m/login`, que abre en modo cliente y muestra "Cuenta creada"). Opcional: enlace "Volver al inicio".
- `Sesion.tsx`, `api.ts`, `auth.dto.ts`: sin cambios. `entrar` ya recibe `perfil`.

Notas de implementación:
- Dos subformularios (`FormularioCliente`, `FormularioComercio`) con su propio `useForm`/esquema, montados de forma excluyente según el modo. Así cambiar de modo desmonta y limpia campos y errores (evita arrastrar un DNI a un campo de correo) y no hay que cambiar el `resolver` dinámicamente.
- El estado del modo es `useState(modoInicial)`; el cambio no cambia la URL. Se mantiene el hook `useSesion` y la redirección si ya hay sesión antes de renderizar el formulario.
- Tras `entrar`, `navegar(inicioDe(s.usuario.perfil), { replace: true })`, como hoy.
- Sin `parseFloat`; no se muestran montos en estas pantallas.

## 4. Textos (español)
Landing:
- Marca: VecinoPay. Título: "El cuaderno del fiado de tu barrio, ahora en digital."
- Descripción: "VecinoPay ayuda a las tiendas de barrio a llevar las compras al crédito de sus vecinos, con cuotas claras, cronograma y registro de pagos."
- Beneficios (3): "Cuotas claras: sabes cuánto pagas, cuándo y por qué." / "Todo en un solo lugar: saldo, cronograma y pagos desde tu celular." / "Para tu tienda y para el vecino: el comercio registra y el cliente consulta."
- Botón principal: "Ingresar" (a `/ingresar`). Enlace: "¿Primera vez? Activa tu cuenta" (a `/m/activar`).
- Nota bajo el enlace: "Tu tienda te entrega un código para activar tu cuenta." No hay botón "Registrarse" ni "Crear tienda".
Ingreso:
- Título "Inicia sesión". Pestañas "Soy cliente" / "Soy dueño".
- Cliente: etiquetas "DNI" y "Contraseña" (se conservan los textos de ayuda actuales). Comercio: "Usuario", "Contraseña", "Perfil" con opciones "Administrador del negocio" y "Administrador del sistema".
- Pie: "¿Primera vez? Activa tu cuenta" y "Volver al inicio".
- Se conservan las etiquetas actuales porque el e2e las usa por `getByLabel(/^(Usuario|DNI)/)` y `/^Contraseña/`, `/^Perfil/`.

## 5. Responsive
- Landing: una columna en celular (cabecera, héroe, beneficios apilados `grid-cols-1`); en `md:` héroe a dos columnas y beneficios `md:grid-cols-3`. Contenedor `max-w-5xl`, botones grandes (mínimo 44 px de alto), colores `vecino-*` ya existentes.
- Ingreso: en celular una columna (marca compacta arriba, tarjeta de formulario `max-w-md`); en `md:` rejilla de 2 columnas (panel oscuro de marca + formulario) como el A01 actual.
- Pestañas a ancho completo, con foco visible y navegables con teclado.

## 6. Pruebas
Unitarias (apps/web/src/pruebas):
- `formularios.test.tsx`: la prueba "el token va a sessionStorage" cambia el import a `Ingreso` y renderiza `<Route path="/login" element={<Ingreso modoInicial="comercio" />}/>`. Debe seguir pasando sin más cambios (etiquetas iguales).
- `cliente.pantallas.test.tsx`, bloque "C01 Login del cliente": renderizar `<Ingreso modoInicial="cliente" />`; mismo caso (DNI "123" -> mensaje, sin llamada a `auth/login`).
- Nuevas (archivo `ingreso.test.tsx`):
  1. Modo cliente envía `perfil: 'CLIENTE'` y `username` = DNI; redirige a `/m`.
  2. Modo comercio con DUENO por defecto envía `perfil: 'DUENO'`; elegir "Administrador del sistema" envía `ADMIN_SISTEMA` y redirige a `/admin`.
  3. Alternar entre "Soy cliente" y "Soy dueño" muestra los campos correctos (DNI vs Usuario + Perfil) y limpia errores.
  4. Con sesión existente, `Ingreso` redirige al inicio del perfil.
  5. Con `state.activada` aparece "Cuenta creada. Ingresa con tu DNI y tu nueva contraseña."
  6. No existe ningún enlace o botón "Registr..." en landing ni en ingreso.
- `pantallas.test.tsx` ("sin sesión va al login"): usa una ruta propia de prueba con `Guarda`; no cambia. Añadir un caso para `Inicio`/Landing: sin sesión en "/" aparece "Ingresar" y "¿Primera vez? Activa tu cuenta" con `href="/m/activar"`; con sesión redirige a su inicio. Exportar `Inicio` desde App o moverlo a `Landing.tsx` para poder probarlo.
E2E (Playwright):
- `e2e/ayudas/sesion.ts`: no requiere cambios (`/login` abre en comercio con DUENO; `/m/login` abre en cliente; etiquetas iguales). Verificar en una corrida.
- `00-humo.spec.ts` y `05-multitienda.spec.ts` usan `/login`: siguen válidos (Elena: mismo mensaje de error y URL `/login`).
- Nueva `e2e/specs/07-landing.spec.ts` (o la numeración libre): `goto('/')` muestra la landing; clic en "Ingresar" llega a `/ingresar`; elegir "Soy cliente" y entrar como un cliente semilla lleva a `/m`; "¿Primera vez? Activa tu cuenta" lleva a `/m/activar`; `/m/login` y `/login` siguen cargando; un usuario con sesión que abre `/` va a su inicio.
- Cuidar que `cerrarSesion` hace `goto('/login')`: no se rompe.

## 7. Orden de implementación
1. Extraer `FormularioComercio` y `FormularioCliente`. 2. Crear `Ingreso` (+ selector). 3. Crear `Landing` y cambiar `Inicio` y rutas en `App.tsx`. 4. Actualizar pruebas unitarias existentes y añadir las nuevas. 5. Correr `npm test` y el e2e. 6. Anotar en `docs/decisiones.md`.

## 8. Riesgos y supuestos
- Cualquier prueba o enlace que busque textos eliminados ("Ingresa al portal móvil aquí", "Portal del Cliente", "Acceso web aquí") fallará: buscarlos con grep antes de borrar (`C01`/`A01` aparecen en pruebas y quizá en la guía de la demo y el readme: revisar `docs/`).
- Dos botones "Ingresar" en pantalla de landing y formulario no conviven (rutas distintas); en `Ingreso` hay un solo "Ingresar" de submit, para que `getByRole('button', { name: 'Ingresar' })` no sea ambiguo. Las pestañas se llaman "Soy cliente"/"Soy dueño", no contienen la palabra "Ingresar".
- En la landing el botón de cabecera y el héroe no deben duplicarse con el mismo nombre accesible si un e2e lo busca: usar un único botón "Ingresar" (el de cabecera), y en el héroe un enlace con texto distinto, por ejemplo "Ir a mi cuenta", o bien un solo botón.
- El mensaje de la API ante credenciales erróneas es genérico y se conserva (no se filtra qué perfil existe).
- Supuesto: la persistencia de la pestaña elegida no es necesaria (no se guarda en almacenamiento).
- Ningún punto **[ESCALAR]**: no cambia cifras, RF entregables, tablas ni plazo. La pantalla extra solo se registra en `docs/decisiones.md`; si Adrián quiere que el Word liste 23 pantallas, eso sí es decisión suya y no bloquea el código.
