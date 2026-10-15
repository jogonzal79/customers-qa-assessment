-- =============================================================================
-- 05 - Pruebas del esquema recomendado
-- -----------------------------------------------------------------------------
-- Intenta cargar en customers_recommended (04) las mismas filas que la API dejó
-- en customers (01/02). Las filas con problemas deben ser rechazadas por la BD.
--
-- Requiere las variables de sesión:
--   @status_customer_id  id del cliente cuyo status quedó fuera del catálogo (TC-12)
--   @duplicate_id        id del cliente creado con el email en mayúsculas (TC-09)
-- scripts/run-sql-validation.js las define a partir de los datos cargados.
--
-- Cada paso se ejecuta por separado: un paso que falla no detiene los demás.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- T1. Cargar las filas sin problemas
-- Esperado: OK. Se insertan las filas con status del catálogo que son la
--           primera aparición de su email.
-- -----------------------------------------------------------------------------
INSERT INTO customers_recommended (id, name, email, status, created_at)
SELECT c.id, c.name, c.email, c.status, c.created_at
FROM customers c
WHERE c.status COLLATE utf8mb4_bin IN ('ACTIVE', 'PENDING', 'BLOCKED')
  AND c.id = (SELECT MIN(d.id) FROM customers d WHERE LOWER(TRIM(d.email)) = LOWER(TRIM(c.email)))
ORDER BY c.id;

-- -----------------------------------------------------------------------------
-- T2. Status fuera del catálogo, tal como lo guardó la API (TC-12)
-- Esperado: ERROR 3819 (violación de ck_customers_recommended_status).
-- -----------------------------------------------------------------------------
INSERT INTO customers_recommended (id, name, email, status, created_at)
SELECT id, name, email, status, created_at
FROM customers
WHERE id = @status_customer_id;

-- -----------------------------------------------------------------------------
-- T3. El mismo cliente con el status que debía conservar (BLOCKED, TC-05)
-- Esperado: OK.
-- -----------------------------------------------------------------------------
INSERT INTO customers_recommended (id, name, email, status, created_at)
SELECT id, name, email, 'BLOCKED', created_at
FROM customers
WHERE id = @status_customer_id;

-- -----------------------------------------------------------------------------
-- T4. Email duplicado que difiere solo en mayúsculas (TC-09)
-- Esperado: ERROR 1062 (violación de uq_customers_recommended_email).
-- -----------------------------------------------------------------------------
INSERT INTO customers_recommended (id, name, email, status, created_at)
SELECT id, name, email, status, created_at
FROM customers
WHERE id = @duplicate_id;

-- -----------------------------------------------------------------------------
-- T5. Por qué no ENUM: MySQL normaliza el valor en silencio
-- Esperado: OK sin error, y el valor guardado es 'ACTIVE' aunque se envió
--           'active'. El problema queda oculto en lugar de rechazarse.
-- -----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS enum_demo;
CREATE TEMPORARY TABLE enum_demo (
  status ENUM('ACTIVE', 'PENDING', 'BLOCKED') NOT NULL
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT INTO enum_demo (status) VALUES ('active');
SELECT 'active' AS valor_enviado, status AS valor_guardado FROM enum_demo;

-- -----------------------------------------------------------------------------
-- T6. Estado final de customers_recommended
-- Esperado: sin duplicados y todos los status dentro del catálogo.
-- -----------------------------------------------------------------------------
SELECT id, name, email, email_normalized, status, created_at
FROM customers_recommended
ORDER BY id;
