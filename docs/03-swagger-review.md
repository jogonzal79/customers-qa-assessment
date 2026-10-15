# Parte 3 — Revisión de Swagger / OpenAPI

**Objeto revisado:** contrato publicado por la aplicación en `GET /openapi.json`, el mismo que muestra Swagger UI en `/docs`
(OpenAPI 3.0.3, "Customers API" 1.0.0).
**Método:** comparación endpoint por endpoint de cada código de respuesta, esquema, enum, header, parámetro y ejemplo
documentado contra requests reales a la API (`http://localhost:3000`). Las discrepancias D-01 a D-03 tienen además
evidencia automatizada en la ejecución de Newman de la Parte 2 (`docs/02-api-testing.md`).

---

## 1. Respuestas

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Los endpoints están correctamente documentados? | **Sí, en estructura.** Los 4 endpoints están documentados con tags, `operationId`, resumen, parámetros, cuerpo y respuestas. Los problemas están en el detalle de las respuestas (D-01, D-04). |
| 2 | ¿Los modelos request/response son claros? | **En general sí.** `Customer`, `CustomerCreate`, `StatusUpdate` y `Error` están definidos con campos obligatorios, tipos, longitudes y enum. Faltan reglas que la API sí aplica: unicidad del email (D-03), normalización de espacios (D-06), campos de solo lectura (D-07) y catálogo de códigos de error (D-05). |
| 3 | ¿Los códigos HTTP coinciden con el comportamiento real? | **No en todos los casos.** El alta documenta **200** y responde **201** (D-01). El PATCH devuelve un 400 `INVALID_ID` que no está descrito para ese endpoint (D-04). Un body que no es JSON da 400 en lugar de 415 (D-08). Los códigos de `GET /customers`, `GET /customers/{id}`, el 404 del PATCH y el 409 del alta coinciden. |
| 4 | ¿Detectaste alguna inconsistencia entre Swagger y la API? | **Sí, dos de severidad alta:** el código de éxito del alta (D-01) y el PATCH de status, que acepta y devuelve valores fuera del enum que el propio contrato declara (D-02). Además hay una ambigüedad de severidad media sobre la regla de duplicados (D-03) y cinco vacíos de documentación de severidad baja (D-04 a D-08). |
| 5 | ¿Qué mejorarías en la documentación? | Corregir el código del alta, alinear el enum de status entre contrato y API, documentar la regla de unicidad del email y enumerar los códigos de error con ejemplos. Detalle en la [sección 5](#5-mejoras-priorizadas). |

---

## 2. Lo que está bien documentado

Verificado con requests reales:

- **`GET /customers`**: 200 con un array de `Customer`. El parámetro `search` está documentado y se comporta como dice
  (coincidencia parcial en name o email, sin distinguir mayúsculas). Sin coincidencias responde `[]`.
- **`GET /customers/{id}`**: 200, 400 (`InvalidId`) y 404 coinciden con lo real (`INVALID_ID`, `CUSTOMER_NOT_FOUND`).
- **`PATCH /customers/{id}/status`**: 200 y 404 coinciden.
- **`CustomerCreate`**: `name` y `email` obligatorios, `status` opcional con valor por defecto `PENDING`, `maxLength` 100 y 254.
  En el alta, el enum de status se respeta (`active` se rechaza con 400).
- **Formato de error** `{ error: { code, message, details[] } }`: lo cumplen todas las respuestas de error observadas.
- **400 por JSON mal formado** (descrito en `BadRequest`): responde `MALFORMED_JSON` en POST y PATCH.
- **409 por email duplicado**: documentado con ejemplo y se cumple ante un duplicado exacto.
- **Header `Location`** del alta: está documentado (aunque bajo un código incorrecto, ver D-01).
- **`Content-Type`** de las respuestas: `application/json; charset=utf-8`, como declara el contrato.

---

## 3. Discrepancias

| ID | Endpoint | Documentado | Real (verificado) | Impacto | Severidad | Evidencia |
|---|---|---|---|---|:---:|---|
| D-01 | `POST /customers` | La respuesta exitosa es **200**, con el header `Location` | **201 Created** + `Location: /customers/{id}` | Clientes generados desde el contrato o integraciones que validan 200 tratan el alta como error o no leen `Location` | **Alta** | Newman R3 / TC-14: `expected '200' to deeply equal '201'` |
| D-02 | `PATCH /customers/{id}/status` | `StatusUpdate.status` usa el enum `ACTIVE`, `PENDING`, `BLOCKED` | `{"status":"active"}` responde **200**, se guarda como `"active"` y la respuesta incumple el esquema `Customer` (status fuera del enum) | La API acepta y devuelve datos que su propio contrato declara inválidos; consumidores que validan contra el esquema fallan | **Alta** | Newman R2 / TC-12: `expected 400 but got 200`; `data.status should be equal to one of the allowed values` |
| D-03 | `POST /customers` (409) | "Ya existe un cliente con ese email", sin definir cómo se comparan | La comparación distingue mayúsculas: `REV.SWAGGER@example.com` se crea con 201 aunque existe `rev.swagger@example.com` | No se puede determinar desde el contrato si se trata de un error o de una regla de negocio | Media | Newman R1 / TC-09: `expected 409 but got 201` |
| D-04 | `PATCH /customers/{id}/status` (400) | Usa `BadRequest` ("datos inválidos o JSON mal formado"), con un ejemplo sobre `field: email` | Con id no numérico responde 400 **`INVALID_ID`**, un caso que en `GET /customers/{id}` sí está documentado como `InvalidId`. El ejemplo sobre `email` no aplica a este endpoint | Documentación incompleta e inconsistente entre GET y PATCH | Baja | `PATCH /customers/abc/status` → 400 `INVALID_ID` |
| D-05 | Todos (errores) | `error.code` es un `string` libre; `InvalidId` no tiene ejemplo | La API usa 5 códigos fijos: `VALIDATION_ERROR`, `MALFORMED_JSON`, `INVALID_ID`, `CUSTOMER_NOT_FOUND`, `EMAIL_ALREADY_EXISTS` | Los consumidores no pueden programar el manejo de errores por código sin probar la API | Baja | Respuestas de error observadas en los 4 endpoints |
| D-06 | `POST /customers` | `name` con `minLength: 1`; no menciona que se quiten espacios | `"  Trim  "` se guarda como `"Trim"` (lo mismo con el email); `"   "` se rechaza con 400 aunque cumple `minLength: 1` | Reglas de validación y normalización que no están en el contrato | Baja | `POST` con `name: "   "` → 400 `field: name` |
| D-07 | `POST /customers` | `id` y `created_at` no están marcados como `readOnly` | Si se envían en el body se ignoran; responde 201 con valores generados por el servidor | No queda claro qué campos acepta la API al crear | Baja | `POST` con `id: 999` → 201 con `id` asignado por el servidor |
| D-08 | `POST /customers` | Solo declara `application/json`; no documenta qué pasa con otro tipo de contenido | Un body `text/plain` responde 400 `VALIDATION_ERROR` "name es obligatorio" en lugar de **415 Unsupported Media Type** | Mensaje de error engañoso; ni el código ni el caso están documentados | Baja | `POST` con `Content-Type: text/plain` → 400 |

---

## 4. Observación: endpoint fuera del contrato

La API expone `POST /__test/reset`, que responde **204** y restaura los datos iniciales. No figura en el contrato y no
requiere autenticación. Es un endpoint de soporte para pruebas: no se cuenta como discrepancia, pero **hay que verificar
que no se despliegue en entornos productivos**, porque permite borrar datos sin autorización.

---

## 5. Mejoras priorizadas

| Prioridad | Mejora | Resuelve |
|:---:|---|---|
| 1 | Corregir la respuesta exitosa del alta a **201** (con `Location`) para que coincida con la API. | D-01 |
| 2 | Hacer que la API rechace con 400 los status fuera del enum en el PATCH, igual que en el alta, o documentar explícitamente si se normalizan. Nunca devolver un valor fuera del enum. | D-02 |
| 3 | Agregar pruebas de contrato en CI (validar respuestas reales contra `/openapi.json`) para detectar desvíos como D-01 y D-02 antes de publicar. | D-01, D-02 |
| 4 | Documentar la regla de unicidad del email (recomendado: sin distinguir mayúsculas) en la descripción del 409 y del campo `email`. | D-03 |
| 5 | Enumerar `error.code` por respuesta y dar a cada respuesta de error su propio ejemplo; usar `InvalidId` también en el PATCH. | D-04, D-05 |
| 6 | Marcar `id` y `created_at` como `readOnly` y documentar que se quitan los espacios de `name` y `email`. | D-06, D-07 |
| 7 | Documentar las respuestas 415 (o rechazar otros tipos de contenido con 415) y 500 genérica. | D-08 |
| 8 | Completar el contrato: esquema de seguridad (hoy no hay ninguno), servidores por entorno (hoy solo `localhost`), paginación y orden en `GET /customers`, y la precedencia 404 sobre 400 en el PATCH. | — |
