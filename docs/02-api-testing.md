# Parte 2 — Testing de API

> **Documento generado automáticamente** por `scripts/generate-api-evidence.js` a partir del reporte de Newman
> (`postman/reports/newman-report.json`). No editar a mano: para regenerarlo, ejecutar `npm run report:api`.

## 1. Ejecución

| Dato | Valor |
|---|---|
| Fecha de ejecución | 2026-10-15 23:20:39 UTC |
| Colección | `postman/customers-api.postman_collection.json` (Customers API - QA Assessment) |
| Environment | `postman/local.postman_environment.json` — `baseUrl = http://localhost:3000` |
| Reporte HTML | `postman/reports/newman-report.html` |
| Comandos cURL equivalentes | `postman/curl-commands.md` |

### Resumen

| Métrica | Total | Pasan | Fallan |
|---|:---:|:---:|:---:|
| Requests | 17 | 13 | 4 |
| Asserts (`pm.test`) | 62 | 54 | 8 |

Un request se marca **FAIL** si al menos uno de sus asserts falla. El resultado esperado sigue la
especificación y las buenas prácticas REST (ver `docs/01-test-cases.md`), no el comportamiento observado.

### Resultado por escenario

| Escenario | TC-ID | Requests | Asserts OK / total | Resultado |
|---|---|:---:|:---:|:---:|
| 01 - Crear cliente válido | TC-01 | 1 | 6 / 6 | PASS |
| 02 - Crear cliente con email inválido | TC-06 | 4 | 16 / 16 | PASS |
| 03 - Crear cliente con email duplicado | TC-08 | 1 | 3 / 3 | PASS |
| 04 - Obtener cliente existente | TC-04 | 1 | 4 / 4 | PASS |
| 05 - Consultar cliente inexistente | TC-10 | 2 | 6 / 6 | PASS |
| 06 - Actualizar status válido | TC-05 | 2 | 7 / 7 | PASS |
| 07 - Actualizar status inválido | TC-11 | 2 | 6 / 6 | PASS |
| R1 - Email duplicado con otras mayúsculas | TC-09 | 1 | 1 / 3 | **FAIL** |
| R2 - Status en minúscula | TC-12 | 2 | 2 / 7 | **FAIL** |
| R3 - Contrato: código del alta documentado vs. real | TC-14 | 1 | 3 / 4 | **FAIL** |

## 2. Evidencia por prueba

| # | TC-ID | Request | Response (resumida) | HTTP | Resultado esperado | Resultado obtenido | Estado |
|:---:|---|---|---|:---:|---|---|:---:|
| 1 | TC-01 | **POST** `/customers`<br>`{"name":"Cliente QA Automatización","email":"qa.auto.1792106439356.7943@example.com","status":"ACTIVE"}` | `Location: /customers/6`<br>`{"id":6,"name":"Cliente QA Automatización","email":"qa.auto.1792106439356.7943@example.com","status":"ACTIVE","created_at":"2026-10-15T23:20:39.389Z"}` | 201 | 201 Created, header Location /customers/{id}, body Customer con los datos enviados | 201 Created. 6/6 asserts OK | PASS |
| 2 | TC-06 | **POST** `/customers`<br>`{"name":"QA Email Inválido","email":"sin-arroba.example.com"}` | `{"error":{"code":"VALIDATION_ERROR","message":"Datos de entrada inválidos","details":[{"field":"email","message":"email no tiene un formato válido"}]}}` | 400 | 400 Bad Request, VALIDATION_ERROR con details.field = email | 400 Bad Request. 4/4 asserts OK | PASS |
| 3 | TC-06 | **POST** `/customers`<br>`{"name":"QA Email Inválido","email":"usuario@"}` | `{"error":{"code":"VALIDATION_ERROR","message":"Datos de entrada inválidos","details":[{"field":"email","message":"email no tiene un formato válido"}]}}` | 400 | 400 Bad Request, VALIDATION_ERROR con details.field = email | 400 Bad Request. 4/4 asserts OK | PASS |
| 4 | TC-06 | **POST** `/customers`<br>`{"name":"QA Email Inválido","email":"usuario@dominio"}` | `{"error":{"code":"VALIDATION_ERROR","message":"Datos de entrada inválidos","details":[{"field":"email","message":"email no tiene un formato válido"}]}}` | 400 | 400 Bad Request, VALIDATION_ERROR con details.field = email | 400 Bad Request. 4/4 asserts OK | PASS |
| 5 | TC-06 | **POST** `/customers`<br>`{"name":"QA Email Inválido","email":"usu ario@example.com"}` | `{"error":{"code":"VALIDATION_ERROR","message":"Datos de entrada inválidos","details":[{"field":"email","message":"email no tiene un formato válido"}]}}` | 400 | 400 Bad Request, VALIDATION_ERROR con details.field = email | 400 Bad Request. 4/4 asserts OK | PASS |
| 6 | TC-08 | **POST** `/customers`<br>`{"name":"QA Duplicado","email":"qa.auto.1792106439356.7943@example.com"}` | `{"error":{"code":"EMAIL_ALREADY_EXISTS","message":"Ya existe un cliente con el email qa.auto.1792106439356.7943@example.com"}}` | 409 | 409 Conflict, EMAIL_ALREADY_EXISTS | 409 Conflict. 3/3 asserts OK | PASS |
| 7 | TC-04 | **GET** `/customers/6` | `{"id":6,"name":"Cliente QA Automatización","email":"qa.auto.1792106439356.7943@example.com","status":"ACTIVE","created_at":"2026-10-15T23:20:39.389Z"}` | 200 | 200 OK, body Customer igual al creado en el paso 01 | 200 OK. 4/4 asserts OK | PASS |
| 8 | TC-10 | **GET** `/customers/999999999` | `{"error":{"code":"CUSTOMER_NOT_FOUND","message":"No existe el cliente con id 999999999"}}` | 404 | 404 Not Found, CUSTOMER_NOT_FOUND | 404 Not Found. 3/3 asserts OK | PASS |
| 9 | TC-10 | **GET** `/customers/abc` | `{"error":{"code":"INVALID_ID","message":"El id debe ser un entero positivo"}}` | 400 | 400 Bad Request, INVALID_ID | 400 Bad Request. 3/3 asserts OK | PASS |
| 10 | TC-05 | **PATCH** `/customers/6/status`<br>`{"status":"BLOCKED"}` | `{"id":6,"name":"Cliente QA Automatización","email":"qa.auto.1792106439356.7943@example.com","status":"BLOCKED","created_at":"2026-10-15T23:20:39.389Z"}` | 200 | 200 OK, body Customer con status BLOCKED y el resto de campos sin cambios | 200 OK. 4/4 asserts OK | PASS |
| 11 | TC-05 | **GET** `/customers/6` | `{"id":6,"name":"Cliente QA Automatización","email":"qa.auto.1792106439356.7943@example.com","status":"BLOCKED","created_at":"2026-10-15T23:20:39.389Z"}` | 200 | 200 OK, status BLOCKED | 200 OK. 3/3 asserts OK | PASS |
| 12 | TC-11 | **PATCH** `/customers/6/status`<br>`{"status":"FOO"}` | `{"error":{"code":"VALIDATION_ERROR","message":"Datos de entrada inválidos","details":[{"field":"status","message":"status debe ser uno de: ACTIVE, PENDING, BLOCKED"}]}}` | 400 | 400 Bad Request, VALIDATION_ERROR con details.field = status | 400 Bad Request. 4/4 asserts OK | PASS |
| 13 | TC-11 | **GET** `/customers/6` | `{"id":6,"name":"Cliente QA Automatización","email":"qa.auto.1792106439356.7943@example.com","status":"BLOCKED","created_at":"2026-10-15T23:20:39.389Z"}` | 200 | 200 OK, status sigue en BLOCKED | 200 OK. 2/2 asserts OK | PASS |
| 14 | TC-09 | **POST** `/customers`<br>`{"name":"QA Duplicado Mayúsculas","email":"QA.AUTO.1792106439356.7943@EXAMPLE.COM"}` | `Location: /customers/7`<br>`{"id":7,"name":"QA Duplicado Mayúsculas","email":"QA.AUTO.1792106439356.7943@EXAMPLE.COM","status":"PENDING","created_at":"2026-10-15T23:20:39.683Z"}` | 201 | 409 Conflict, EMAIL_ALREADY_EXISTS (el email difiere solo en mayúsculas) | 201 Created. Fallan 2 de 3 asserts: "Status code es 409" (expected response to have status code 409 but got 201); "Body cumple el esquema Error con code EMAIL_ALREADY_EXISTS" (expected data to satisfy schema but found following errors: data should have required property 'error') | **FAIL** |
| 15 | TC-12 | **PATCH** `/customers/6/status`<br>`{"status":"active"}` | `{"id":6,"name":"Cliente QA Automatización","email":"qa.auto.1792106439356.7943@example.com","status":"active","created_at":"2026-10-15T23:20:39.389Z"}` | 200 | 400 Bad Request, VALIDATION_ERROR con details.field = status | 200 OK. Fallan 3 de 4 asserts: "Status code es 400" (expected response to have status code 400 but got 200); "Body cumple el esquema Error con code VALIDATION_ERROR" (expected data to satisfy schema but found following errors: data should have required property 'error'); "error.details incluye el campo 'status'" (expected [] to include 'status') | **FAIL** |
| 16 | TC-12 | **GET** `/customers/6` | `{"id":6,"name":"Cliente QA Automatización","email":"qa.auto.1792106439356.7943@example.com","status":"active","created_at":"2026-10-15T23:20:39.389Z"}` | 200 | 200 OK, status sigue en BLOCKED y pertenece al catálogo | 200 OK. Fallan 2 de 3 asserts: "Body cumple el esquema Customer" (expected data to satisfy schema but found following errors: data.status should be equal to one of the allowed values); "El status sigue siendo BLOCKED" (expected 'active' to deeply equal 'BLOCKED') | **FAIL** |
| 17 | TC-14 | **GET** `/openapi.json` | `{"paths":{"/customers":{"post":{"responses":["200","400","409"]}}}} (resumido)` | 200 | El contrato documenta para POST /customers el mismo código 2xx que devolvió el alta del paso 01 (201) | 200 OK. Fallan 1 de 4 asserts: "El código documentado coincide con el real del alta (201)" (expected '200' to deeply equal '201') | **FAIL** |

## 3. Detalle de asserts

### 01 - Crear cliente válido [TC-01]

**#1 POST /customers - alta válida** — HTTP 201 Created

- ✅ Status code es 201
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Customer
- ✅ Header Location apunta al cliente creado
- ✅ Body devuelve los datos enviados
- ✅ created_at es una fecha ISO-8601 válida

### 02 - Crear cliente con email inválido [TC-06]

**#2 POST /customers - email "sin-arroba.example.com"** — HTTP 400 Bad Request

- ✅ Status code es 400
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Error con code VALIDATION_ERROR
- ✅ error.details incluye el campo 'email'

**#3 POST /customers - email "usuario@"** — HTTP 400 Bad Request

- ✅ Status code es 400
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Error con code VALIDATION_ERROR
- ✅ error.details incluye el campo 'email'

**#4 POST /customers - email "usuario@dominio"** — HTTP 400 Bad Request

- ✅ Status code es 400
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Error con code VALIDATION_ERROR
- ✅ error.details incluye el campo 'email'

**#5 POST /customers - email "usu ario@example.com"** — HTTP 400 Bad Request

- ✅ Status code es 400
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Error con code VALIDATION_ERROR
- ✅ error.details incluye el campo 'email'

### 03 - Crear cliente con email duplicado [TC-08]

**#6 POST /customers - email ya registrado** — HTTP 409 Conflict

- ✅ Status code es 409
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Error con code EMAIL_ALREADY_EXISTS

### 04 - Obtener cliente existente [TC-04]

**#7 GET /customers/{id} - cliente creado en 01** — HTTP 200 OK

- ✅ Status code es 200
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Customer
- ✅ Body corresponde al cliente creado

### 05 - Consultar cliente inexistente [TC-10]

**#8 GET /customers/{id} - id inexistente** — HTTP 404 Not Found

- ✅ Status code es 404
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Error con code CUSTOMER_NOT_FOUND

**#9 GET /customers/{id} - id no numérico** — HTTP 400 Bad Request

- ✅ Status code es 400
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Error con code INVALID_ID

### 06 - Actualizar status válido [TC-05]

**#10 PATCH /customers/{id}/status - BLOCKED** — HTTP 200 OK

- ✅ Status code es 200
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Customer
- ✅ status actualizado a BLOCKED y el resto sin cambios

**#11 GET /customers/{id} - verifica que el cambio persiste** — HTTP 200 OK

- ✅ Status code es 200
- ✅ Body cumple el esquema Customer
- ✅ El status guardado es BLOCKED

### 07 - Actualizar status inválido [TC-11]

**#12 PATCH /customers/{id}/status - FOO** — HTTP 400 Bad Request

- ✅ Status code es 400
- ✅ Header Content-Type es application/json
- ✅ Body cumple el esquema Error con code VALIDATION_ERROR
- ✅ error.details incluye el campo 'status'

**#13 GET /customers/{id} - verifica que el status no cambió** — HTTP 200 OK

- ✅ Status code es 200
- ✅ El status sigue siendo BLOCKED

### R1 - Email duplicado con otras mayúsculas [TC-09]

**#14 POST /customers - email ya registrado en mayúsculas** — HTTP 201 Created

- ❌ Status code es 409 — _expected response to have status code 409 but got 201_
- ✅ Header Content-Type es application/json
- ❌ Body cumple el esquema Error con code EMAIL_ALREADY_EXISTS — _expected data to satisfy schema but found following errors: 
data should have required property 'error'_

### R2 - Status en minúscula [TC-12]

**#15 PATCH /customers/{id}/status - "active"** — HTTP 200 OK

- ❌ Status code es 400 — _expected response to have status code 400 but got 200_
- ✅ Header Content-Type es application/json
- ❌ Body cumple el esquema Error con code VALIDATION_ERROR — _expected data to satisfy schema but found following errors: 
data should have required property 'error'_
- ❌ error.details incluye el campo 'status' — _expected [] to include 'status'_

**#16 GET /customers/{id} - verifica que el status no cambió** — HTTP 200 OK

- ✅ Status code es 200
- ❌ Body cumple el esquema Customer — _expected data to satisfy schema but found following errors: 
data.status should be equal to one of the allowed values_
- ❌ El status sigue siendo BLOCKED — _expected 'active' to deeply equal 'BLOCKED'_

### R3 - Contrato: código del alta documentado vs. real [TC-14]

**#17 GET /openapi.json - código documentado para POST /customers** — HTTP 200 OK

- ✅ Status code es 200
- ✅ Header Content-Type es application/json
- ✅ El contrato documenta un único código 2xx para POST /customers
- ❌ El código documentado coincide con el real del alta (201) — _expected '200' to deeply equal '201'_

## 4. Hallazgos

Requests con resultado distinto al esperado, agrupados por caso de prueba:

| TC-ID | Escenario | Esperado | Obtenido |
|---|---|---|---|
| TC-09 | R1 - Email duplicado con otras mayúsculas — POST /customers - email ya registrado en mayúsculas | 409 Conflict, EMAIL_ALREADY_EXISTS (el email difiere solo en mayúsculas) | 201 Created: expected response to have status code 409 but got 201; expected data to satisfy schema but found following errors: data should have required property 'error' |
| TC-12 | R2 - Status en minúscula — PATCH /customers/{id}/status - "active" | 400 Bad Request, VALIDATION_ERROR con details.field = status | 200 OK: expected response to have status code 400 but got 200; expected data to satisfy schema but found following errors: data should have required property 'error'; expected [] to include 'status' |
| TC-12 | R2 - Status en minúscula — GET /customers/{id} - verifica que el status no cambió | 200 OK, status sigue en BLOCKED y pertenece al catálogo | 200 OK: expected data to satisfy schema but found following errors: data.status should be equal to one of the allowed values; expected 'active' to deeply equal 'BLOCKED' |
| TC-14 | R3 - Contrato: código del alta documentado vs. real — GET /openapi.json - código documentado para POST /customers | El contrato documenta para POST /customers el mismo código 2xx que devolvió el alta del paso 01 (201) | 200 OK: expected '200' to deeply equal '201' |

## 5. Notas de ejecución

- La colección se ejecuta en orden y encadena variables: el alta (`01`) guarda `customerId`, `customerEmail` y
  `createStatusCode`, que reutilizan los pasos siguientes. El email del alta es dinámico, por lo que la colección no
  necesita datos semilla ni el endpoint de reset y puede ejecutarse contra un entorno real.
- La API no expone `DELETE`: si el caso TC-09 falla en un entorno real, el cliente duplicado creado queda registrado y
  debe limpiarse por fuera de la colección.
- `npm run test:api` ejecuta la misma colección y termina con código de salida distinto de 0 mientras existan fallos,
  para que un pipeline de CI lo detecte. `npm run report:api` no corta por fallos para poder generar la evidencia.
