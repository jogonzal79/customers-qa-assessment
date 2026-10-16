# Parte 7 — Reporte de defecto

## BUG-001 — [Frontend][Alta de clientes] La UI muestra "Cliente creado correctamente" cuando la API rechaza el alta (409/400)

| Campo | Valor |
|---|---|
| **ID** | BUG-001 |
| **Tipo** | Defecto funcional |
| **Componente** | Frontend · Pantalla de clientes · Formulario de alta (`mock-app/public/app.js`) |
| **Severidad** | **Alta** |
| **Prioridad** | **Alta (P1)** |
| **Frecuencia** | 100 % (siempre que la API responde un status no 2xx al alta) |
| **Estado** | Abierto |
| **Riesgo / casos relacionados** | R-04 · TC-20 (falla), TC-19, TC-08 |
| **Causa raíz** | Ver [docs/06-bug-investigation.md](06-bug-investigation.md), sección 5 |

### Ambiente

| Elemento | Versión |
|---|---|
| Código bajo prueba | Commit `1bdf15b` (rama `main`) |
| Aplicación | `http://localhost:3000` (frontend y API servidos por la misma app; Node v24.4.0, Express 4.22.3) |
| Navegador | Chromium 156.0.8078.4 (Playwright 1.64.1) |
| Herramientas | Playwright 1.64.1, Newman 6.2.3 |
| Sistema operativo | Windows 11 Pro |

### Precondiciones

1. La aplicación está en ejecución (`npm run mock`).
2. Datos iniciales cargados (`POST /__test/reset` → 204). Existe el cliente `María García` con email
   `maria.garcia@example.com`.

### Pasos para reproducir

1. Abrir `http://localhost:3000/` en el navegador.
2. En "Nuevo cliente", escribir **Nombre:** `María Repetida`.
3. Escribir **Email:** `maria.garcia@example.com` (ya registrado).
4. Dejar **Status** en `PENDING`.
5. Pulsar **Crear cliente**.
6. *(Opcional)* Con DevTools → Network abierto, observar la respuesta del `POST /customers`.

**Paso alternativo (error de validación, 400):** repetir los pasos 1–5 dejando el **Nombre vacío** y con
**Email:** `sin.nombre@example.com`. El resultado es el mismo.

### Resultado actual

- La API responde **409 Conflict** con `{"error":{"code":"EMAIL_ALREADY_EXISTS", ...}}` (en el paso alternativo,
  **400 Bad Request** `VALIDATION_ERROR`).
- La UI muestra el mensaje verde **"Cliente creado correctamente"** (`data-status="success"`).
- El formulario se limpia y la tabla se recarga con los mismos 5 clientes: el usuario no tiene ninguna señal de que
  el alta falló y pierde los datos que había escrito.
- El cliente no existe: una consulta posterior por API o por base de datos no lo encuentra.

### Resultado esperado

- La UI muestra un mensaje de **error** (`data-status="error"`) con el motivo devuelto por la API, por ejemplo
  "Ya existe un cliente con el email maria.garcia@example.com".
- No se muestra "Cliente creado correctamente".
- El formulario conserva los datos para que el usuario pueda corregirlos.
- La tabla no cambia.

### Severidad y prioridad

| | Valor | Justificación |
|---|---|---|
| **Severidad** | Alta | Confirmación falsa con pérdida de datos silenciosa. Afecta a **todo** alta rechazada (duplicados y errores de validación), no a un caso aislado. No es Crítica: no hay caída del sistema, el backend responde y persiste correctamente, y el usuario puede detectarlo revisando la tabla. |
| **Prioridad** | P1 | Flujo principal de la pantalla, reproducible el 100 % de las veces; genera altas "fantasma" y reclamos. La corrección es acotada (evaluar el status de la respuesta y mostrar el error de la API) y ya existe un test automatizado para validarla (TC-20). |

### Causa raíz

El manejador `submit` del formulario de alta en `mock-app/public/app.js` muestra el mensaje de éxito sin evaluar
`res.ok` ni el status de la respuesta del `POST /customers`; después resetea el formulario y recarga la lista. El
backend se comporta según el contrato (409 para duplicados, 400 para validaciones). Análisis completo y descarte de
hipótesis en [docs/06-bug-investigation.md](06-bug-investigation.md).

### Evidencia

| Evidencia | Archivo | Qué muestra |
|---|---|---|
| Screenshot del fallo | [`e2e/evidence/TC-20/screenshot.png`](../e2e/evidence/TC-20/screenshot.png) | Mensaje "Cliente creado correctamente" con la tabla aún en 5 clientes |
| Trace de Playwright | [`e2e/evidence/TC-20/trace.zip`](../e2e/evidence/TC-20/trace.zip) | Red: `POST /customers → 409` seguido de `GET /customers → 200`; DOM antes y después. Abrir en <https://trace.playwright.dev> o con `npx playwright show-trace e2e/evidence/TC-20/trace.zip` |
| Resumen de la ejecución | [`e2e/evidence/summary.json`](../e2e/evidence/summary.json) | `api-response`: `POST /customers → 409 EMAIL_ALREADY_EXISTS`; `ui-message`: `data-status="success" · texto="Cliente creado correctamente" (respuesta HTTP 409)` |
| Reporte E2E | [`docs/05-e2e-testing.md`](05-e2e-testing.md), sección 3 | Assertion fallida: `Expected: "error"` · `Received: "success"` |
| Comportamiento de la API sin la UI | [`docs/02-api-testing.md`](02-api-testing.md), prueba #6 (TC-08); [`postman/reports/newman-report.html`](../postman/reports/newman-report.html) | Un email duplicado responde 409 `EMAIL_ALREADY_EXISTS`: el backend es correcto |
| Paso alternativo (400) | — | Verificado durante la redacción de este reporte con una ejecución puntual de Playwright (name vacío → 400; email inválido → 400; en ambos la UI mostró éxito). Sin artefacto archivado; se reproduce con el paso alternativo. |

![Screenshot del fallo TC-20](../e2e/evidence/TC-20/screenshot.png)

### Criterio de aceptación de la corrección

- `npm run test:e2e` pasa TC-20.
- Al pasar, se quita el tag `@known-risk` de TC-20 para que forme parte de `npm run test:e2e:stable` (CI).

---

## Otros defectos encontrados

| ID | Título | Severidad | Estado | Evidencia | TC |
|---|---|:---:|---|---|---|
| BUG-002 | La API acepta un email duplicado que difiere solo en mayúsculas (201 en lugar de 409) | Alta | Confirmado | Newman R1 ([docs/02](02-api-testing.md)); SQL Q1 y Q3, prueba T4 ([docs/04](04-mysql-validation.md)) | TC-09, TC-23 |
| BUG-003 | `PATCH /customers/{id}/status` acepta valores en minúscula (`active`) y los guarda fuera del catálogo | Alta | Confirmado | Newman R2 ([docs/02](02-api-testing.md)); SQL Q2 y Q5 ([docs/04](04-mysql-validation.md)); D-02 ([docs/03](03-swagger-review.md)) | TC-12, TC-23 |
| BUG-004 | El contrato OpenAPI documenta 200 para `POST /customers`; la API responde 201 | Alta | Confirmado | Newman R3 ([docs/02](02-api-testing.md)); D-01 ([docs/03](03-swagger-review.md)) | TC-14 |
| BUG-005 | La lista de clientes puede mostrar resultados desactualizados por una carrera entre respuestas de `GET /customers` | Baja | Riesgo potencial, no reproducido | Análisis del código del frontend ([docs/05](05-e2e-testing.md), sección 7) | TC-21 |

**BUG-005:** identificado por análisis del código (el frontend no cancela ni ordena peticiones concurrentes); no se
reprodujo porque requiere un orden de respuestas que no ocurre con la API local y la suite E2E lo evita a propósito
esperando la recarga posterior al alta.
