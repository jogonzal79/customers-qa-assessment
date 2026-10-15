# Parte 1 — Diseño de casos de prueba

**Sistema bajo prueba:** aplicación de gestión de clientes (frontend web + API REST + MySQL).
**Alcance:** alta, consulta, búsqueda y cambio de status de clientes.

El resultado esperado de cada caso se define según la especificación funcional y las buenas prácticas REST
(RFC 9110), no según el comportamiento observado. Cuando la especificación no define una regla, el criterio
usado se declara en la sección [Supuestos](#supuestos).

---

## 1. Resumen

### 1.1 Conteo por tipo

| Tipo | Cantidad | Casos |
|---|:---:|---|
| Positivo | 5 | TC-01 a TC-05 |
| Negativo | 8 | TC-06 a TC-13 |
| Contrato | 1 | TC-14 |
| Límite | 4 | TC-15 a TC-18 |
| Integración frontend–backend (E2E) | 4 | TC-19 a TC-22 |
| Integración backend–BD | 1 | TC-23 |
| **Total** | **23** | |

### 1.2 Matriz de riesgos

| ID | Riesgo | Impacto | Casos que lo detectan |
|---|---|---|---|
| R-01 | El control de email duplicado depende de mayúsculas/minúsculas y permite registrar dos veces el mismo buzón. | Clientes duplicados, notificaciones dobles, datos inconsistentes. | TC-09, TC-23 |
| R-02 | El cambio de status acepta o guarda valores fuera del catálogo oficial (por ejemplo, en minúscula). | Filtros, reportes y reglas de negocio que comparan por `ACTIVE`/`PENDING`/`BLOCKED` dejan de funcionar. | TC-11, TC-12, TC-23 |
| R-03 | El contrato publicado (OpenAPI / Swagger) no coincide con el comportamiento real de la API. | Integradores y clientes generados desde el contrato fallan o interpretan mal las respuestas. | TC-14 |
| R-04 | El frontend informa éxito sin verificar la respuesta del backend. | El usuario cree que el cliente se creó cuando no fue así; pérdida de datos silenciosa. | TC-20 |
| R-05 | Validación de entrada insuficiente o mensajes de error incorrectos. | Datos inválidos persistidos, errores 500 en lugar de 4xx. | TC-06, TC-07, TC-13, TC-15, TC-16, TC-17 |
| R-06 | Manejo incorrecto de recursos inexistentes o identificadores mal formados. | Códigos HTTP ambiguos, errores no controlados. | TC-10, TC-18 |
| R-07 | Inconsistencia entre lo que muestra la UI, lo que devuelve la API y lo que guarda la BD. | El usuario ve información distinta a la real. | TC-19, TC-21, TC-22, TC-23 |

### 1.3 Índice de casos

| ID | Escenario | Tipo | Capa | Endpoint | Prioridad | Cubierto en |
|---|---|---|---|---|:---:|---|
| TC-01 | Crear cliente con datos válidos | Positivo | API | `POST /customers` | Alta | Postman |
| TC-02 | Crear cliente sin status | Positivo | API | `POST /customers` | Media | Postman |
| TC-03 | Listar y buscar clientes | Positivo | API | `GET /customers` | Alta | Postman |
| TC-04 | Obtener cliente por id existente | Positivo | API | `GET /customers/{id}` | Alta | Postman |
| TC-05 | Cambiar status a un valor válido | Positivo | API | `PATCH /customers/{id}/status` | Alta | Postman |
| TC-06 | Crear con email de formato inválido | Negativo | API | `POST /customers` | Alta | Postman |
| TC-07 | Crear sin campos obligatorios | Negativo | API | `POST /customers` | Alta | Postman |
| TC-08 | Crear con email duplicado (idéntico) | Negativo | API | `POST /customers` | Alta | Postman |
| TC-09 | Crear con email duplicado con otras mayúsculas | Negativo | API | `POST /customers` | Alta | Postman |
| TC-10 | Consultar o modificar un cliente inexistente o con id no numérico | Negativo | API | `GET /customers/{id}`, `PATCH /customers/{id}/status` | Media | Postman |
| TC-11 | Cambiar status a un valor fuera del catálogo | Negativo | API | `PATCH /customers/{id}/status` | Alta | Postman |
| TC-12 | Cambiar status a un valor del catálogo escrito en minúscula | Negativo | API | `PATCH /customers/{id}/status` | Alta | Postman |
| TC-13 | Enviar JSON mal formado | Negativo | API | `POST /customers` | Media | Postman |
| TC-14 | Código de éxito del alta: contrato publicado vs. respuesta real | Contrato | API | `GET /openapi.json`, `POST /customers` | Media | Postman |
| TC-15 | Longitud de `name` en el límite (100 / 101) | Límite | API | `POST /customers` | Media | Postman |
| TC-16 | Longitud de `email` en el límite (254 / 255) | Límite | API | `POST /customers` | Media | Postman |
| TC-17 | `name` y `email` con espacios | Límite | API | `POST /customers` | Media | Postman |
| TC-18 | Identificadores en la frontera | Límite | API | `GET /customers/{id}` | Baja | Postman |
| TC-19 | Alta desde la UI y verificación en API y BD | Integración | E2E | `POST /customers`, `GET /customers/{id}` | Alta | Playwright, SQL |
| TC-20 | Alta desde la UI rechazada por el backend | Integración | E2E | `POST /customers` | Alta | Playwright |
| TC-21 | Búsqueda en la UI coherente con la API | Integración | E2E | `GET /customers?search=` | Media | Playwright |
| TC-22 | Cambio de status por API reflejado en la UI | Integración | E2E | `PATCH /customers/{id}/status`, `GET /customers` | Media | Playwright |
| TC-23 | Integridad de datos en la tabla `customers` | Integración | BD | — (tabla `customers`) | Alta | SQL |

**Prioridad:** Alta = afecta integridad de datos o el flujo principal; Media = afecta la calidad de respuesta o
casos frecuentes de error; Baja = entradas poco probables con impacto acotado.

---

## 2. Precondiciones generales

- **PG-1.** Antes de cada caso se restaura el estado inicial con `POST /__test/reset` (endpoint de soporte para
  pruebas, fuera del contrato). El estado inicial contiene estos clientes:

  | id | name | email | status |
  |:---:|---|---|---|
  | 1 | Juan Pérez | juan.perez@example.com | ACTIVE |
  | 2 | María García | maria.garcia@example.com | ACTIVE |
  | 3 | Carlos López | carlos.lopez@example.com | PENDING |
  | 4 | Ana Martínez | ana.martinez@example.com | BLOCKED |
  | 5 | Luis Rodríguez | luis.rodriguez@example.com | PENDING |

- **PG-2.** Todas las peticiones con body envían `Content-Type: application/json` con codificación UTF-8.
- **PG-3.** Todas las respuestas de error deben tener `Content-Type: application/json` y el formato
  `{ "error": { "code", "message", "details"? } }` (ver S-08).

---

## 3. Casos positivos

### TC-01 — Crear cliente con datos válidos

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Positivo · API · Alta |
| Endpoint | `POST /customers` |
| Escenario | Se da de alta un cliente nuevo indicando name, email y status. |
| Datos de entrada | `{ "name": "Pedro Sánchez", "email": "pedro.sanchez@example.com", "status": "ACTIVE" }` |
| Resultado esperado | **201 Created**. Header `Location: /customers/{id}`. Body con `id` entero nuevo (6), `name` y `email` iguales a los enviados, `status: "ACTIVE"` y `created_at` en formato ISO-8601 UTC con la fecha/hora actual. `GET` a la URL de `Location` devuelve el mismo cliente. |
| Cubierto en | Postman |

### TC-02 — Crear cliente sin status

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Positivo · API · Media |
| Endpoint | `POST /customers` |
| Escenario | Se da de alta un cliente sin indicar status. |
| Datos de entrada | `{ "name": "Lucía Torres", "email": "lucia.torres@example.com" }` |
| Resultado esperado | **201 Created**. El cliente se crea con `status: "PENDING"` (S-01). |
| Cubierto en | Postman |

### TC-03 — Listar y buscar clientes

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Positivo · API · Alta |
| Endpoint | `GET /customers`, `GET /customers?search=` |
| Escenario | Se consulta el listado completo y luego se filtra por fragmentos de nombre y de email. |
| Datos de entrada | a) Sin parámetros. b) `search=MARTÍNEZ` (nombre, en mayúsculas). c) `search=lopez` (fragmento de email). d) `search=zzz` (sin coincidencias). |
| Resultado esperado | **200 OK** en todos los casos, body siempre es un array. a) 5 clientes; cada uno tiene exactamente `id`, `name`, `email`, `status`, `created_at`, y `status` pertenece al catálogo. b) Solo el cliente 4. c) Solo el cliente 3. d) Array vacío `[]` (no 404). |
| Cubierto en | Postman |

### TC-04 — Obtener cliente por id existente

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Positivo · API · Alta |
| Endpoint | `GET /customers/{id}` |
| Escenario | Se consulta un cliente existente por su identificador. |
| Datos de entrada | `id = 2` |
| Resultado esperado | **200 OK**. Body: `id: 2`, `name: "María García"`, `email: "maria.garcia@example.com"`, `status: "ACTIVE"`, `created_at` presente. |
| Cubierto en | Postman |

### TC-05 — Cambiar status a un valor válido

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Positivo · API · Alta |
| Endpoint | `PATCH /customers/{id}/status` |
| Escenario | Se cambia el status de un cliente PENDING a ACTIVE y se verifica que el cambio persiste. |
| Datos de entrada | `id = 3`, body `{ "status": "ACTIVE" }` |
| Resultado esperado | **200 OK** con el cliente actualizado (`status: "ACTIVE"`). `id`, `name`, `email` y `created_at` no cambian. Un `GET /customers/3` posterior devuelve `status: "ACTIVE"`. |
| Cubierto en | Postman |

---

## 4. Casos negativos

### TC-06 — Crear con email de formato inválido

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Negativo · API · Alta |
| Endpoint | `POST /customers` |
| Escenario | Se intenta crear un cliente con emails mal formados. Se ejecuta una petición por cada valor. |
| Datos de entrada | `name: "Test Email"` y `email` = `sin-arroba.example.com` · `usuario@` · `usuario@dominio` · `usu ario@example.com` |
| Resultado esperado | **400 Bad Request** en cada petición, `error.code: "VALIDATION_ERROR"` y un elemento en `details` con `field: "email"`. El listado sigue teniendo 5 clientes. |
| Cubierto en | Postman |

### TC-07 — Crear sin campos obligatorios

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Negativo · API · Alta |
| Endpoint | `POST /customers` |
| Escenario | Se intenta crear un cliente sin name y/o sin email. |
| Datos de entrada | a) `{}` b) `{ "email": "solo.email@example.com" }` c) `{ "name": "Solo Nombre" }` |
| Resultado esperado | **400 Bad Request**, `VALIDATION_ERROR`. a) `details` incluye `name` y `email`. b) `details` incluye `name`. c) `details` incluye `email`. No se crea ningún cliente. |
| Cubierto en | Postman |

### TC-08 — Crear con email duplicado (idéntico)

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Negativo · API · Alta |
| Endpoint | `POST /customers` |
| Escenario | Se intenta crear un cliente con el email exacto de un cliente existente. |
| Datos de entrada | `{ "name": "Otro Juan", "email": "juan.perez@example.com" }` |
| Resultado esperado | **409 Conflict**, `error.code: "EMAIL_ALREADY_EXISTS"`. El listado sigue teniendo 5 clientes. |
| Cubierto en | Postman |

### TC-09 — Crear con email duplicado con otras mayúsculas

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Negativo · API · Alta |
| Endpoint | `POST /customers` |
| Escenario | Se intenta crear un cliente con el email de un cliente existente escrito con otra combinación de mayúsculas/minúsculas. Representa el mismo buzón (S-04). |
| Datos de entrada | a) `{ "name": "Juan Duplicado", "email": "JUAN.PEREZ@example.com" }` b) `{ "name": "María Duplicada", "email": "Maria.Garcia@Example.COM" }` |
| Resultado esperado | **409 Conflict**, `error.code: "EMAIL_ALREADY_EXISTS"` en ambos casos. No se crea ningún cliente: `GET /customers?search=juan.perez` devuelve un solo resultado. |
| Observación | Con el esquema supuesto (S-09), la collation por defecto de MySQL 8 (`utf8mb4_0900_ai_ci`) hace que `UNIQUE(email)` no distinga mayúsculas. En un entorno real este duplicado lo rechazaría la **base de datos** y no la API. Si la API no captura esa excepción (`ER_DUP_ENTRY`, error 1062) y la traduce a 409, la respuesta sería **500 Internal Server Error**. Este caso debe ejecutarse también contra el entorno con MySQL real para confirmar que la respuesta es 409 y no 500. |
| Cubierto en | Postman (complementado por TC-23 en SQL) |

### TC-10 — Consultar o modificar un cliente inexistente o con id no numérico

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Negativo · API · Media |
| Endpoint | `GET /customers/{id}`, `PATCH /customers/{id}/status` |
| Escenario | Se consulta y se intenta modificar un cliente que no existe, y se usa un id que no es un número. |
| Datos de entrada | a) `GET /customers/999` b) `GET /customers/abc` c) `PATCH /customers/999/status` con `{ "status": "ACTIVE" }` d) `PATCH /customers/abc/status` con `{ "status": "ACTIVE" }` |
| Resultado esperado | a) **404 Not Found**, `CUSTOMER_NOT_FOUND`. b) **400 Bad Request**, `INVALID_ID`. c) **404 Not Found**, `CUSTOMER_NOT_FOUND`. d) **400 Bad Request**, `INVALID_ID`. En ningún caso 500. |
| Cubierto en | Postman |

### TC-11 — Cambiar status a un valor fuera del catálogo

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Negativo · API · Alta |
| Endpoint | `PATCH /customers/{id}/status` |
| Escenario | Se intenta asignar un status inexistente, vacío o ausente. |
| Datos de entrada | `id = 3` y body: a) `{ "status": "FOO" }` b) `{ "status": "" }` c) `{}` d) `{ "status": 1 }` |
| Resultado esperado | **400 Bad Request**, `VALIDATION_ERROR`, `details` con `field: "status"`. `GET /customers/3` sigue devolviendo `status: "PENDING"`. |
| Cubierto en | Postman |

### TC-12 — Cambiar status a un valor del catálogo escrito en minúscula

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Negativo · API · Alta |
| Endpoint | `PATCH /customers/{id}/status` |
| Escenario | Se intenta asignar un status válido pero escrito con mayúsculas distintas a las del catálogo. El alta (`POST`) ya rechaza estos valores, por lo que el cambio de status debe ser coherente (S-05). |
| Datos de entrada | `id = 3` y body: a) `{ "status": "active" }` b) `{ "status": "Blocked" }` |
| Resultado esperado | **400 Bad Request**, `VALIDATION_ERROR`, `details` con `field: "status"`. `GET /customers/3` sigue devolviendo `status: "PENDING"`. En ningún caso se debe guardar un valor distinto de `ACTIVE`, `PENDING` o `BLOCKED`. |
| Observación | Si la columna en MySQL es `ENUM` (S-09), la base normaliza `'active'` a `'ACTIVE'` al guardarlo y el problema quedaría oculto en BD, pero la API seguiría devolviendo el valor sin normalizar en la respuesta del `PATCH`. Si la columna es `VARCHAR`, el valor se guardaría literalmente; TC-23 lo detecta. |
| Cubierto en | Postman (complementado por TC-23 en SQL) |

### TC-13 — Enviar JSON mal formado

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Negativo · API · Media |
| Endpoint | `POST /customers` |
| Escenario | Se envía un body que no es JSON válido. |
| Datos de entrada | Body literal: `{"name": "Juan",` (con `Content-Type: application/json`) |
| Resultado esperado | **400 Bad Request** con body JSON de error (`error.code: "MALFORMED_JSON"`). No debe responder 500 ni una página HTML. |
| Cubierto en | Postman |

---

## 5. Caso de contrato

### TC-14 — Código de éxito del alta: contrato publicado vs. respuesta real

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Contrato · API · Media |
| Endpoint | `GET /openapi.json`, `POST /customers` |
| Escenario | Se compara el código de respuesta exitoso que documenta el contrato publicado para el alta con el que devuelve realmente la API. |
| Datos de entrada | 1) `GET /openapi.json` → leer las claves de `paths["/customers"].post.responses`. 2) `POST /customers` con `{ "name": "Contrato Test", "email": "contrato.test@example.com" }`. |
| Resultado esperado | El contrato documenta **201** como respuesta exitosa del alta (y no 200), y el `POST` devuelve **201**. El código documentado y el real coinciden. La vista `/docs` muestra la misma información que `/openapi.json`. |
| Cubierto en | Postman |

---

## 6. Casos límite

### TC-15 — Longitud de `name` en el límite

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Límite · API · Media |
| Endpoint | `POST /customers` |
| Escenario | Se prueba el mínimo y el máximo de caracteres de `name` (S-02). |
| Datos de entrada | a) `name` = `"A"` (1 carácter). b) `name` = `"A"` × 100. c) `name` = `"A"` × 101. Cada uno con un email único (`limite.name.a@example.com`, etc.). |
| Resultado esperado | a) **201**, se guarda `"A"`. b) **201**, `name` guardado con 100 caracteres. c) **400**, `VALIDATION_ERROR` con `field: "name"`; no se crea. |
| Cubierto en | Postman |

### TC-16 — Longitud de `email` en el límite

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Límite · API · Media |
| Endpoint | `POST /customers` |
| Escenario | Se prueba el largo máximo total de `email` (S-03). |
| Datos de entrada | a) 254 caracteres: `"a"×64 + "@" + "b"×63 + "." + "c"×63 + "." + "d"×57 + ".com"`. b) 255 caracteres: igual que (a) pero con `"d"×58`. |
| Resultado esperado | a) **201**, el email se guarda completo (254 caracteres). b) **400**, `VALIDATION_ERROR` con `field: "email"`; no se crea. |
| Cubierto en | Postman |

### TC-17 — `name` y `email` con espacios

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Límite · API · Media |
| Endpoint | `POST /customers` |
| Escenario | Se envían valores formados solo por espacios y valores con espacios al inicio y al final (S-02, S-03). |
| Datos de entrada | a) `{ "name": "   ", "email": "espacios@example.com" }` b) `{ "name": "  Pedro Gómez  ", "email": "  pedro.gomez@example.com  " }` |
| Resultado esperado | a) **400**, `VALIDATION_ERROR` con `field: "name"`. b) **201**, se guardan `name: "Pedro Gómez"` y `email: "pedro.gomez@example.com"` sin espacios. Un alta posterior con `pedro.gomez@example.com` responde **409**. |
| Cubierto en | Postman |

### TC-18 — Identificadores en la frontera

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Límite · API · Baja |
| Endpoint | `GET /customers/{id}` |
| Escenario | Se prueban ids en el borde de lo válido y lo existente (S-06). |
| Datos de entrada | a) `0` b) `-1` c) `01` d) `1.5` e) `5` (último existente) f) `6` (último + 1) |
| Resultado esperado | a–d) **400**, `INVALID_ID`. e) **200** con el cliente 5. f) **404**, `CUSTOMER_NOT_FOUND`. |
| Cubierto en | Postman |

---

## 7. Casos de integración frontend–backend (E2E)

### TC-19 — Alta desde la UI y verificación en API y BD

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Integración · E2E · Alta |
| Endpoint | `POST /customers`, `GET /customers/{id}` |
| Escenario | Un usuario da de alta un cliente desde el formulario; se verifica el resultado en la UI, en la API y en la base de datos. |
| Datos de entrada | En `/`: `input-name` = `Elena Ruiz`, `input-email` = `elena.ruiz@example.com`, `select-status` = `ACTIVE`; clic en `btn-create`. |
| Resultado esperado | 1) La petición `POST /customers` responde **201**. 2) `create-message` es visible con el texto "Cliente creado correctamente" y `data-status="success"`. 3) La tabla (`customers-table`) muestra una fila nueva con ese nombre, email y status `ACTIVE`; `customers-count` indica 6 clientes. 4) `GET /customers/{id}` (id tomado de la respuesta del POST) devuelve los mismos datos. 5) En BD: `SELECT name, email, status FROM customers WHERE email = 'elena.ruiz@example.com';` devuelve exactamente una fila con los mismos valores. 6) El formulario queda vacío. |
| Cubierto en | Playwright (pasos 1–4 y 6), SQL (paso 5) |

### TC-20 — Alta desde la UI rechazada por el backend

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Integración · E2E · Alta |
| Endpoint | `POST /customers` |
| Escenario | Un usuario intenta dar de alta desde el formulario un cliente que el backend rechaza. La UI debe reflejar el resultado real de la petición. |
| Datos de entrada | a) `input-name` = `María Repetida`, `input-email` = `maria.garcia@example.com` (ya existe). b) `input-name` vacío, `input-email` = `sin.nombre@example.com`. Clic en `btn-create` en cada caso. |
| Resultado esperado | a) La petición responde **409**. b) La petición responde **400**. En ambos: `create-message` es visible con `data-status="error"`, muestra el motivo devuelto por la API y **no** muestra "Cliente creado correctamente". La tabla sigue mostrando 5 clientes. |
| Cubierto en | Playwright |

### TC-21 — Búsqueda en la UI coherente con la API

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Integración · E2E · Media |
| Endpoint | `GET /customers?search=` |
| Escenario | Un usuario busca clientes desde la UI; la tabla debe mostrar exactamente lo que devuelve la API para el mismo término. |
| Datos de entrada | a) `search-input` = `MARÍA` + `btn-search`. b) `search-input` = `example.com` + `btn-search`. c) `search-input` = `zzz` + `btn-search`. d) `btn-clear-search`. |
| Resultado esperado | a) La tabla muestra solo la fila `customer-row-2`, igual que `GET /customers?search=MARÍA`. b) 5 filas. c) Tabla vacía, `empty-state` visible, `customers-count` = "0 cliente(s)". d) Vuelven a verse las 5 filas. En todos los casos los ids de la tabla coinciden con los de la respuesta de la API. |
| Cubierto en | Playwright |

### TC-22 — Cambio de status por API reflejado en la UI

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Integración · E2E · Media |
| Endpoint | `PATCH /customers/{id}/status`, `GET /customers` |
| Escenario | El status de un cliente se cambia desde otro sistema (API) y la UI debe mostrar el valor actualizado. La UI no ofrece edición de status (S-12). |
| Datos de entrada | `PATCH /customers/4/status` con `{ "status": "ACTIVE" }`; luego recargar `/`. |
| Resultado esperado | El `PATCH` responde **200**. Tras recargar, en la fila `customer-row-4` la celda `customer-status` muestra `ACTIVE`. Las demás filas no cambian. |
| Cubierto en | Playwright |

---

## 8. Caso de integración backend–BD

### TC-23 — Integridad de datos en la tabla `customers`

| Campo | Detalle |
|---|---|
| Tipo / Capa / Prioridad | Integración · BD · Alta |
| Endpoint | — (consulta directa a la tabla `customers`, esquema S-09) |
| Escenario | Después de ejecutar la suite de API y E2E (sin reset final), se verifica que la base de datos no contiene datos que violen las reglas de negocio. |
| Datos de entrada | Las consultas Q1–Q4 de abajo. |
| Resultado esperado | Las cuatro consultas devuelven **0 filas**. |
| Cubierto en | SQL |

```sql
-- Q1. Emails duplicados sin distinguir mayúsculas/minúsculas (R-01)
SELECT LOWER(email) AS email_normalizado, COUNT(*) AS total
FROM customers
GROUP BY LOWER(email)
HAVING COUNT(*) > 1;

-- Q2. Status fuera del catálogo, comparando byte a byte (R-02)
SELECT id, status
FROM customers
WHERE BINARY status NOT IN ('ACTIVE', 'PENDING', 'BLOCKED');

-- Q3. Campos obligatorios nulos o vacíos
SELECT id
FROM customers
WHERE name IS NULL OR TRIM(name) = ''
   OR email IS NULL OR TRIM(email) = ''
   OR created_at IS NULL;

-- Q4. Fechas de creación en el futuro
SELECT id, created_at
FROM customers
WHERE created_at > UTC_TIMESTAMP();
```

---

## Supuestos

La especificación del cliente solo define los campos (`id`, `name`, `email`, `status`, `created_at`), el catálogo
de status y los cuatro endpoints. Las siguientes reglas se asumen para poder definir resultados esperados
verificables y deben confirmarse con el cliente.

| ID | Supuesto | Casos afectados |
|---|---|---|
| S-01 | Si no se envía `status` en el alta, el cliente se crea en `PENDING`. | TC-02 |
| S-02 | `name` es obligatorio, se guarda sin espacios al inicio/final y debe tener entre **1 y 100** caracteres después de quitarlos. No se restringen caracteres (se admiten tildes y ñ). | TC-07, TC-15, TC-17 |
| S-03 | `email` es obligatorio, se guarda sin espacios al inicio/final, debe tener formato `local@dominio.tld` y un máximo de **254** caracteres en total (límite de RFC 5321). Solo se valida la longitud total, no la de cada parte. | TC-06, TC-16, TC-17 |
| S-04 | El email es único **sin distinguir mayúsculas/minúsculas**: `Juan@x.com` y `juan@x.com` se consideran el mismo cliente. Aunque RFC 5321 permite que la parte local distinga mayúsculas, en la práctica los proveedores no lo hacen y la regla de negocio es "un cliente por buzón". | TC-09, TC-23 |
| S-05 | Los valores de `status` válidos son exactamente `ACTIVE`, `PENDING` y `BLOCKED`, en mayúsculas, tanto en el alta como en el cambio de status. Otro valor (incluidas variantes en minúscula) se rechaza con 400. | TC-11, TC-12, TC-23 |
| S-06 | `id` es un entero positivo sin ceros a la izquierda. Un id mal formado responde **400**; un id bien formado que no existe responde **404**. | TC-10, TC-18 |
| S-07 | `GET /customers` acepta un parámetro opcional `search` que filtra por coincidencia parcial en `name` o `email`, sin distinguir mayúsculas. Sin coincidencias, responde 200 con `[]`. La especificación pide el buscador en la UI pero no define el parámetro de la API. | TC-03, TC-21 |
| S-08 | Los errores siguen el formato `{ "error": { "code", "message", "details"? } }`, con códigos `VALIDATION_ERROR`, `MALFORMED_JSON`, `INVALID_ID`, `CUSTOMER_NOT_FOUND` y `EMAIL_ALREADY_EXISTS`. | TC-06 a TC-13, TC-15 a TC-18 |
| S-09 | **Esquema MySQL supuesto** (ver abajo). La columna `email` tiene `UNIQUE` y `status` es `ENUM`. | TC-09, TC-12, TC-19, TC-23 |
| S-10 | Existe un mecanismo para restaurar los datos iniciales antes de cada caso (`POST /__test/reset` en el entorno de pruebas). | Todos |
| S-11 | El contrato de referencia es el publicado por la aplicación (`/openapi.json` y su vista `/docs`). | TC-14 |
| S-12 | La UI no permite cambiar el status; ese cambio solo se hace por API. | TC-22 |

### Esquema MySQL supuesto (S-09)

```sql
CREATE TABLE customers (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(254) NOT NULL,
  status      ENUM('ACTIVE', 'PENDING', 'BLOCKED') NOT NULL DEFAULT 'PENDING',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_customers_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### Riesgos derivados de los supuestos de BD

| Riesgo | Detalle | Caso relacionado |
|---|---|---|
| Duplicado rechazado por la BD en lugar de la API | Con la collation por defecto de MySQL 8 (`utf8mb4_0900_ai_ci`, que no distingue mayúsculas ni tildes), `UNIQUE(email)` rechaza `JUAN.PEREZ@example.com` si existe `juan.perez@example.com`. Si la API no valida antes ni captura el error 1062 (`ER_DUP_ENTRY`), responderá **500** en lugar de **409**. | TC-09 |
| Normalización silenciosa del status | Una columna `ENUM` guarda `'active'` como `'ACTIVE'`, por lo que un problema de validación en la API puede no verse en la BD. Si la columna fuera `VARCHAR`, el valor se guardaría literalmente. Q2 usa `BINARY` para detectarlo en ambos casos. | TC-12, TC-23 |
| Diferencia de zona horaria en `created_at` | Si la BD guarda la hora local del servidor y la API la expone como UTC, las fechas pueden quedar desplazadas. Q4 compara con `UTC_TIMESTAMP()` asumiendo que se guarda en UTC. | TC-01, TC-23 |
