# Parte 4 — Validación en MySQL

> **Documento generado automáticamente** por `scripts/run-sql-validation.js`. No editar a mano:
> para regenerarlo, ejecutar `npm run db:up` y luego `npm run report:sql` con el mock en ejecución.

## 1. Enfoque

La aplicación de referencia no incluye base de datos, así que el estado que deja la API se lleva a un MySQL real
en Docker y se valida con consultas SQL. Se usan dos esquemas:

| Esquema | Archivo | Para qué |
|---|---|---|
| `customers` (observado) | `sql/01-schema-observed.sql` | Guarda los datos **tal como los dejó la API**, sin restricciones que los corrijan o rechacen. Sobre él corren las consultas Q1–Q7. |
| `customers_recommended` | `sql/04-schema-recommended.sql` | Esquema propuesto que **impide** en la BD los problemas detectados. Se prueba cargando las mismas filas (T1–T6). |

Con el esquema supuesto en la Parte 1 (S-09: `UNIQUE(email)` con `utf8mb4_0900_ai_ci` y status `ENUM`) los datos
problemáticos no podrían cargarse tal cual: el duplicado se rechazaría y `'active'` se guardaría como `'ACTIVE'`.
Por eso se separa la **detección** (esquema observado) de la **prevención** (esquema recomendado).

## 2. Ejecución

| Dato | Valor |
|---|---|
| Fecha | 2026-10-15 23:42:57 UTC |
| Motor | MySQL 8.4.11 (`docker-compose.yml`, servicio `mysql`, puerto 3307) |
| Operaciones previas por API | Colección de Postman (Parte 2) ejecutada con Newman tras un reset: 62 asserts, 8 fallidos (los riesgos conocidos R1–R3). Incluye TC-01 (alta), TC-05 (cambio a BLOCKED), TC-09 (alta con email en mayúsculas) y TC-12 (status `active`). |
| Cliente de referencia (TC-01) | id 6, `qa.auto.1792107772592.8520@example.com` |
| Datos cargados | `sql/02-data.sql`, generado desde `GET /customers`: 7 filas |
| Evidencia en texto plano | `sql/evidence/03-validation-queries.txt`, `sql/evidence/05-recommended-schema-tests.txt` |

Datos cargados en `customers`:

| id | name | email | status | created_at (UTC) |
|:---:|---|---|---|---|
| 1 | Juan Pérez | juan.perez@example.com | `ACTIVE` | 2026-01-10T09:00:00.000Z |
| 2 | María García | maria.garcia@example.com | `ACTIVE` | 2026-02-14T11:30:00.000Z |
| 3 | Carlos López | carlos.lopez@example.com | `PENDING` | 2026-03-01T15:45:00.000Z |
| 4 | Ana Martínez | ana.martinez@example.com | `BLOCKED` | 2026-04-20T08:15:00.000Z |
| 5 | Luis Rodríguez | luis.rodriguez@example.com | `PENDING` | 2026-05-05T17:00:00.000Z |
| 6 | Cliente QA Automatización | qa.auto.1792107772592.8520@example.com | `active` | 2026-10-15T23:42:52.610Z |
| 7 | QA Duplicado Mayúsculas | QA.AUTO.1792107772592.8520@EXAMPLE.COM | `PENDING` | 2026-10-15T23:42:52.907Z |

## 3. Consultas de validación (esquema observado)

Archivo: `sql/03-validation-queries.sql`. Los emails se comparan con `LOWER(TRIM(email))` y el status con
`COLLATE utf8mb4_bin` (comparación binaria, equivalente a `BINARY` sin el operador obsoleto desde MySQL 8.0.27).

| ID | Consulta | Esperado | Obtenido | Resultado |
|---|---|---|---|:---:|
| Q1 | Localizar un cliente por email | exactamente 1 fila. | 2 fila(s) | **NO CUMPLE** |
| Q2 | Verificar el status del cliente | 1 fila con status = 'BLOCKED', status_esperado = 'SI' y en_catalogo = 'SI'. | status = 'active' | **NO CUMPLE** |
| Q3 | Detectar emails duplicados | 0 filas. | 1 grupo(s) duplicado(s) | **NO CUMPLE** |
| Q4 | Listar los últimos 5 clientes creados | 5 filas, las más recientes primero. | 5 fila(s) | CUMPLE |
| Q5 | Status fuera del catálogo (TC-23 Q2) | 0 filas. | 1 fila(s) | **NO CUMPLE** |
| Q6 | Campos obligatorios nulos o vacíos (TC-23 Q3) | 0 filas. | 0 fila(s) | CUMPLE |
| Q7 | Fechas de creación en el futuro (TC-23 Q4) | 0 filas. | 0 fila(s) | CUMPLE |

### Q1. Localizar un cliente por email

**Propósito:** encontrar el cliente creado en TC-01 sin depender de cómo se escribieron las mayúsculas.

**Esperado:** exactamente 1 fila.

```sql
SELECT id, name, email, status, created_at
FROM customers
WHERE LOWER(TRIM(email)) = LOWER(TRIM(@email))
ORDER BY id;
```

**Salida real:**

```text
+----+----------------------------+----------------------------------------+---------+-------------------------+
| id | name                       | email                                  | status  | created_at              |
+----+----------------------------+----------------------------------------+---------+-------------------------+
|  6 | Cliente QA Automatización  | qa.auto.1792107772592.8520@example.com | active  | 2026-10-15 23:42:52.610 |
|  7 | QA Duplicado Mayúsculas    | QA.AUTO.1792107772592.8520@EXAMPLE.COM | PENDING | 2026-10-15 23:42:52.907 |
+----+----------------------------+----------------------------------------+---------+-------------------------+
```

**Resultado:** **NO CUMPLE** — 2 fila(s).

### Q2. Verificar el status del cliente

**Propósito:** confirmar que el status guardado es el esperado tras TC-05 (BLOCKED) y que pertenece al catálogo, en comparación binaria.

**Esperado:** 1 fila con status = 'BLOCKED', status_esperado = 'SI' y en_catalogo = 'SI'.

```sql
SELECT id,
       email,
       status,
       IF(status COLLATE utf8mb4_bin = 'BLOCKED', 'SI', 'NO')                             AS status_esperado,
       IF(status COLLATE utf8mb4_bin IN ('ACTIVE', 'PENDING', 'BLOCKED'), 'SI', 'NO')    AS en_catalogo
FROM customers
WHERE email COLLATE utf8mb4_bin = @email;
```

**Salida real:**

```text
+----+----------------------------------------+--------+-----------------+-------------+
| id | email                                  | status | status_esperado | en_catalogo |
+----+----------------------------------------+--------+-----------------+-------------+
|  6 | qa.auto.1792107772592.8520@example.com | active | NO              | NO          |
+----+----------------------------------------+--------+-----------------+-------------+
```

**Resultado:** **NO CUMPLE** — status = 'active'.

### Q3. Detectar emails duplicados

**Propósito:** encontrar emails registrados más de una vez, sin distinguir mayúsculas ni espacios (TC-23 Q1).

**Esperado:** 0 filas.

```sql
SELECT LOWER(TRIM(email))                    AS email_normalizado,
       COUNT(*)                              AS total,
       GROUP_CONCAT(id ORDER BY id)          AS ids,
       GROUP_CONCAT(email ORDER BY id SEPARATOR ' | ') AS variantes
FROM customers
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1;
```

**Salida real:**

```text
+----------------------------------------+-------+------+---------------------------------------------------------------------------------+
| email_normalizado                      | total | ids  | variantes                                                                       |
+----------------------------------------+-------+------+---------------------------------------------------------------------------------+
| qa.auto.1792107772592.8520@example.com |     2 | 6,7  | qa.auto.1792107772592.8520@example.com | QA.AUTO.1792107772592.8520@EXAMPLE.COM |
+----------------------------------------+-------+------+---------------------------------------------------------------------------------+
```

**Resultado:** **NO CUMPLE** — 1 grupo(s) duplicado(s).

### Q4. Listar los últimos 5 clientes creados

**Propósito:** verificar que los clientes creados por la API quedan registrados y ordenados por fecha de creación. id desempata fechas iguales.

**Esperado:** 5 filas, las más recientes primero.

```sql
SELECT id, name, email, status, created_at
FROM customers
ORDER BY created_at DESC, id DESC
LIMIT 5;
```

**Salida real:**

```text
+----+----------------------------+----------------------------------------+---------+-------------------------+
| id | name                       | email                                  | status  | created_at              |
+----+----------------------------+----------------------------------------+---------+-------------------------+
|  7 | QA Duplicado Mayúsculas    | QA.AUTO.1792107772592.8520@EXAMPLE.COM | PENDING | 2026-10-15 23:42:52.907 |
|  6 | Cliente QA Automatización  | qa.auto.1792107772592.8520@example.com | active  | 2026-10-15 23:42:52.610 |
|  5 | Luis Rodríguez             | luis.rodriguez@example.com             | PENDING | 2026-05-05 17:00:00.000 |
|  4 | Ana Martínez               | ana.martinez@example.com               | BLOCKED | 2026-04-20 08:15:00.000 |
|  3 | Carlos López               | carlos.lopez@example.com               | PENDING | 2026-03-01 15:45:00.000 |
+----+----------------------------+----------------------------------------+---------+-------------------------+
```

**Resultado:** CUMPLE — 5 fila(s).

### Q5. Status fuera del catálogo (TC-23 Q2)

**Propósito:** detectar cualquier status distinto, byte a byte, de los valores permitidos. Una comparación no binaria no detectaría 'active'.

**Esperado:** 0 filas.

```sql
SELECT id, email, status
FROM customers
WHERE status COLLATE utf8mb4_bin NOT IN ('ACTIVE', 'PENDING', 'BLOCKED');
```

**Salida real:**

```text
+----+----------------------------------------+--------+
| id | email                                  | status |
+----+----------------------------------------+--------+
|  6 | qa.auto.1792107772592.8520@example.com | active |
+----+----------------------------------------+--------+
```

**Resultado:** **NO CUMPLE** — 1 fila(s).

### Q6. Campos obligatorios nulos o vacíos (TC-23 Q3)

**Esperado:** 0 filas.

```sql
SELECT id, name, email, created_at
FROM customers
WHERE name IS NULL OR TRIM(name) = ''
   OR email IS NULL OR TRIM(email) = ''
   OR created_at IS NULL;
```

**Salida real:**

```text
Empty set (0 filas)
```

**Resultado:** CUMPLE — 0 fila(s).

### Q7. Fechas de creación en el futuro (TC-23 Q4)

**Propósito:** created_at se guarda en UTC; ninguna fecha puede superar la hora actual del servidor en UTC.

**Esperado:** 0 filas.

```sql
SELECT id, email, created_at
FROM customers
WHERE created_at > UTC_TIMESTAMP(3);
```

**Salida real:**

```text
Empty set (0 filas)
```

**Resultado:** CUMPLE — 0 fila(s).

## 4. Esquema recomendado

```sql
DROP TABLE IF EXISTS customers_recommended;

CREATE TABLE customers_recommended (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  email             VARCHAR(254) NOT NULL,
  email_normalized  VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin
                    GENERATED ALWAYS AS (LOWER(TRIM(email))) STORED,
  status            VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL DEFAULT 'PENDING',
  created_at        DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  CONSTRAINT uq_customers_recommended_email UNIQUE (email_normalized),
  CONSTRAINT ck_customers_recommended_status CHECK (status IN ('ACTIVE', 'PENDING', 'BLOCKED')),
  CONSTRAINT ck_customers_recommended_name CHECK (TRIM(name) <> ''),
  INDEX ix_customers_recommended_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

| Regla | Implementación | Por qué |
|---|---|---|
| Email único sin distinguir mayúsculas | Columna generada `email_normalized = LOWER(TRIM(email))` con `UNIQUE` y collation binaria | `UNIQUE(email)` con `utf8mb4_0900_ai_ci` también ignora tildes, una regla más amplia de lo que pide el negocio |
| Status solo del catálogo | `VARCHAR(10)` con collation `utf8mb4_bin` y `CHECK (status IN (...))` | Un `ENUM` convierte `'active'` en `'ACTIVE'` sin error (T5) y oculta la falla de validación de la API |
| name no vacío | `CHECK (TRIM(name) <> '')` | Refuerza en la BD la regla de la API |

### Pruebas (`sql/05-recommended-schema-tests.sql`)

Variables: `@status_customer_id = 6` (status fuera de catálogo), `@duplicate_id = 7` (email duplicado en mayúsculas).

| ID | Prueba | Esperado | Obtenido | Resultado |
|---|---|---|---|:---:|
| T1 | Cargar las filas sin problemas | OK | OK | OK |
| T2 | Status fuera del catálogo, tal como lo guardó la API (TC-12) | ERROR 3819 | ERROR 3819 | OK |
| T3 | El mismo cliente con el status que debía conservar (BLOCKED, TC-05) | OK | OK | OK |
| T4 | Email duplicado que difiere solo en mayúsculas (TC-09) | ERROR 1062 | ERROR 1062 | OK |
| T5 | Por qué no ENUM: MySQL normaliza el valor en silencio | OK | OK | OK |
| T6 | Estado final de customers_recommended | OK | OK | OK |

#### T1. Cargar las filas sin problemas

```sql
INSERT INTO customers_recommended (id, name, email, status, created_at)
SELECT c.id, c.name, c.email, c.status, c.created_at
FROM customers c
WHERE c.status COLLATE utf8mb4_bin IN ('ACTIVE', 'PENDING', 'BLOCKED')
  AND c.id = (SELECT MIN(d.id) FROM customers d WHERE LOWER(TRIM(d.email)) = LOWER(TRIM(c.email)))
ORDER BY c.id;
```

**Salida real:**

```text
OK (sin filas de salida)
```

#### T2. Status fuera del catálogo, tal como lo guardó la API (TC-12)

```sql
INSERT INTO customers_recommended (id, name, email, status, created_at)
SELECT id, name, email, status, created_at
FROM customers
WHERE id = @status_customer_id;
```

**Salida real:**

```text
ERROR 3819 (HY000) at line 3: Check constraint 'ck_customers_recommended_status' is violated.
```

#### T3. El mismo cliente con el status que debía conservar (BLOCKED, TC-05)

```sql
INSERT INTO customers_recommended (id, name, email, status, created_at)
SELECT id, name, email, 'BLOCKED', created_at
FROM customers
WHERE id = @status_customer_id;
```

**Salida real:**

```text
OK (sin filas de salida)
```

#### T4. Email duplicado que difiere solo en mayúsculas (TC-09)

```sql
INSERT INTO customers_recommended (id, name, email, status, created_at)
SELECT id, name, email, status, created_at
FROM customers
WHERE id = @duplicate_id;
```

**Salida real:**

```text
ERROR 1062 (23000) at line 3: Duplicate entry 'qa.auto.1792107772592.8520@example.com' for key 'customers_recommended.uq_customers_recommended_email'
```

#### T5. Por qué no ENUM: MySQL normaliza el valor en silencio

```sql
DROP TEMPORARY TABLE IF EXISTS enum_demo;
CREATE TEMPORARY TABLE enum_demo (
  status ENUM('ACTIVE', 'PENDING', 'BLOCKED') NOT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO enum_demo (status) VALUES ('active');
SELECT 'active' AS valor_enviado, status AS valor_guardado FROM enum_demo;
```

**Salida real:**

```text
+---------------+----------------+
| valor_enviado | valor_guardado |
+---------------+----------------+
| active        | ACTIVE         |
+---------------+----------------+
```

#### T6. Estado final de customers_recommended

```sql
SELECT id, name, email, email_normalized, status, created_at
FROM customers_recommended
ORDER BY id;
```

**Salida real:**

```text
+----+----------------------------+----------------------------------------+----------------------------------------+---------+-------------------------+
| id | name                       | email                                  | email_normalized                       | status  | created_at              |
+----+----------------------------+----------------------------------------+----------------------------------------+---------+-------------------------+
|  1 | Juan Pérez                 | juan.perez@example.com                 | juan.perez@example.com                 | ACTIVE  | 2026-01-10 09:00:00.000 |
|  2 | María García               | maria.garcia@example.com               | maria.garcia@example.com               | ACTIVE  | 2026-02-14 11:30:00.000 |
|  3 | Carlos López               | carlos.lopez@example.com               | carlos.lopez@example.com               | PENDING | 2026-03-01 15:45:00.000 |
|  4 | Ana Martínez               | ana.martinez@example.com               | ana.martinez@example.com               | BLOCKED | 2026-04-20 08:15:00.000 |
|  5 | Luis Rodríguez             | luis.rodriguez@example.com             | luis.rodriguez@example.com             | PENDING | 2026-05-05 17:00:00.000 |
|  6 | Cliente QA Automatización  | qa.auto.1792107772592.8520@example.com | qa.auto.1792107772592.8520@example.com | BLOCKED | 2026-10-15 23:42:52.610 |
+----+----------------------------+----------------------------------------+----------------------------------------+---------+-------------------------+
```

## 5. Conclusiones

Las consultas detectan 4 incumplimiento(s) sobre los datos que dejó la API: Q1 (2 fila(s)), Q2 (status = 'active'), Q3 (1 grupo(s) duplicado(s)), Q5 (1 fila(s)).
Corresponden a los riesgos R-01 (email duplicado con otras mayúsculas, TC-09) y R-02 (status fuera del catálogo, TC-12)
ya detectados por API en la Parte 2. La base de datos confirma que esos datos quedan **persistidos**.

El esquema recomendado rechaza 2 de 2 filas problemáticas (T2: ERROR 3819, T4: ERROR 1062).
Esto actualiza el supuesto S-09 de la Parte 1: para el status se recomienda `CHECK` con collation binaria en lugar de `ENUM`.
Como señala la observación de TC-09, la API debe traducir el error 1062 a **409** y no a 500.
