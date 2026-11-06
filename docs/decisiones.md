# Registro de decisiones

| Fecha | Tema | Decisión | Por qué |
|---|---|---|---|
| 2026-11-05 | Base de datos | SQL Server 2022, 11 tablas del informe | El informe v8 (sección 8) es lo que se entrega |
| 2026-11-05 | Reparto de IA | Claude genera todo el código | Decisión del grupo; se debe declarar en la sección 9 |
| 2026-11-05 | Node | Node 22 (mínimo 20) | Node 20 sin soporte desde abril de 2026 |
| 2026-11-05 | Anexo 4 | El script SQL se reconstruye desde las tablas 23 a 33 de la sección 8 | En el Word el script está como imagen |
| 2026-11-06 | TIR | La bisección para cuando abs(VA − P) < 0.000001, no por ancho de intervalo | 6.3k y Figura 39 dan 0.0011469966; parar por ancho de intervalo no lo reproduce. El prompt solo decía "tolerancia" |
| 2026-11-06 | VAN | Acumula sin redondear y aplica Red al final; los VA redondeados solo se muestran | Figura 41 da 20.01; sumar los VA redondeados daría 20.00 (ver escalaciones) |
| 2026-11-06 | Red con negativos | Se usa piso, no trunc | 6.3e y CLAUDE.md; la Figura 27 usa trunc y difiere si el VAN es negativo (ver escalaciones) |
| 2026-11-06 | Interés de cuota | Días reales del período, no la TEM | 6.3j, 6.1.3, Figura 37 y Tabla 19 frente a la descripción de la Tabla 29 (ver escalaciones) |
| 2026-11-06 | Acción de auditoría | El corte se audita como ALTA en listado_pago con usuario NULL | La Tabla 33 no tiene la acción CORTE; manda el informe sobre el prompt |
| 2026-11-06 | tienda_id | compra_detalle, cuota, listado_item y pago no lo llevan; se hereda por FK, con FK compuestas y triggers; la API filtra con JOIN | Las Tablas 28, 29, 31 y 32 son la definición concreta; el texto de la sección 8 dice otra cosa (ver escalaciones) |
| 2026-11-06 | Unicidad en listado_item | Sin índice único por compra o cuota; el corte de la API evita el doble cobro | Propuesta del arquitecto retirada: la Tabla 34 declara 0:N; tenía razón el auditor. Manda el informe |
| 2026-11-06 | Empate de medio céntimo en cuotas | No se trata aparte: el interés usa la TED guardada de 15 decimales. Con TNA 42 % mensual y saldo entero impar, 3.00 × 0.035 da 0.10 y no 0.11 | La sección 8 y 6.1.3 fijan la TED guardada; ninguna cifra del informe cambia y cae dentro de la tolerancia de S/ 0.01 de 6.4 |
| 2026-11-06 | Límites de pruebas y fechas | descuento.test.ts no usa las dos variantes de TED; sumarDias no trata el año 9999 | valorHoy recibe la TEA, no la TED; ese año no es alcanzable en este sistema. El revisor estuvo de acuerdo |
| 2026-11-06 | Ronda 1, revisor | No se agregan triggers para cuota de compra FIN_MES ni para cambiar la tienda de un producto vendido; TRUNCATE de auditoría y secretos por defecto de docker-compose quedan para la fase 3 | Lo controla la API y el informe no lo exige; se anotó en el diseño, sección 9.1 |
| 2026-11-06 | Ciclo | AsignarCiclo usa la fecha operativa (Tabla 13) | Equivale a la Figura 31; una prueba lo compara en 1.3 millones de combinaciones |
| 2026-11-06 | Datos de semilla | Lo que el informe no da se inventa y se marca FICTICIO (demo) | El detalle de compras y el catálogo no están en el informe; no cambian ninguna cifra de 6.4 |
