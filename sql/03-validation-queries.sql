-- =============================================================================
-- 03 - Consultas de validación (esquema observado)
-- -----------------------------------------------------------------------------
-- Requiere la variable de sesión @email con el email del cliente creado en
-- TC-01. scripts/run-sql-validation.js la define antes de ejecutar este archivo.
-- Para ejecutarlo a mano:
--   SET @email = 'qa.auto.XXXX@example.com';
--   SOURCE sql/03-validation-queries.sql;
--
-- Criterios de robustez (TC-23, docs/01-test-cases.md):
--   * Los emails se comparan sin distinguir mayúsculas y sin espacios:
--     LOWER(TRIM(email)).
--   * El status se compara en forma binaria (COLLATE utf8mb4_bin) para que
--     'active' no se confunda con 'ACTIVE'. Es equivalente a BINARY status,
--     pero sin el operador BINARY, obsoleto desde MySQL 8.0.27.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Q1. Localizar un cliente por email
-- Propósito: encontrar el cliente creado en TC-01 sin depender de cómo se
--            escribieron las mayúsculas.
-- Esperado:  exactamente 1 fila.
-- -----------------------------------------------------------------------------
SELECT id, name, email, status, created_at
FROM customers
WHERE LOWER(TRIM(email)) = LOWER(TRIM(@email))
ORDER BY id;

-- -----------------------------------------------------------------------------
-- Q2. Verificar el status del cliente
-- Propósito: confirmar que el status guardado es el esperado tras TC-05
--            (BLOCKED) y que pertenece al catálogo, en comparación binaria.
-- Esperado:  1 fila con status = 'BLOCKED', status_esperado = 'SI' y
--            en_catalogo = 'SI'.
-- -----------------------------------------------------------------------------
SELECT id,
       email,
       status,
       IF(status COLLATE utf8mb4_bin = 'BLOCKED', 'SI', 'NO')                             AS status_esperado,
       IF(status COLLATE utf8mb4_bin IN ('ACTIVE', 'PENDING', 'BLOCKED'), 'SI', 'NO')    AS en_catalogo
FROM customers
WHERE email COLLATE utf8mb4_bin = @email;

-- -----------------------------------------------------------------------------
-- Q3. Detectar emails duplicados
-- Propósito: encontrar emails registrados más de una vez, sin distinguir
--            mayúsculas ni espacios (TC-23 Q1).
-- Esperado:  0 filas.
-- -----------------------------------------------------------------------------
SELECT LOWER(TRIM(email))                    AS email_normalizado,
       COUNT(*)                              AS total,
       GROUP_CONCAT(id ORDER BY id)          AS ids,
       GROUP_CONCAT(email ORDER BY id SEPARATOR ' | ') AS variantes
FROM customers
GROUP BY LOWER(TRIM(email))
HAVING COUNT(*) > 1;

-- -----------------------------------------------------------------------------
-- Q4. Listar los últimos 5 clientes creados
-- Propósito: verificar que los clientes creados por la API quedan registrados
--            y ordenados por fecha de creación. id desempata fechas iguales.
-- Esperado:  5 filas, las más recientes primero.
-- -----------------------------------------------------------------------------
SELECT id, name, email, status, created_at
FROM customers
ORDER BY created_at DESC, id DESC
LIMIT 5;

-- -----------------------------------------------------------------------------
-- Q5. Status fuera del catálogo (TC-23 Q2)
-- Propósito: detectar cualquier status distinto, byte a byte, de los valores
--            permitidos. Una comparación no binaria no detectaría 'active'.
-- Esperado:  0 filas.
-- -----------------------------------------------------------------------------
SELECT id, email, status
FROM customers
WHERE status COLLATE utf8mb4_bin NOT IN ('ACTIVE', 'PENDING', 'BLOCKED');

-- -----------------------------------------------------------------------------
-- Q6. Campos obligatorios nulos o vacíos (TC-23 Q3)
-- Esperado:  0 filas.
-- -----------------------------------------------------------------------------
SELECT id, name, email, created_at
FROM customers
WHERE name IS NULL OR TRIM(name) = ''
   OR email IS NULL OR TRIM(email) = ''
   OR created_at IS NULL;

-- -----------------------------------------------------------------------------
-- Q7. Fechas de creación en el futuro (TC-23 Q4)
-- Propósito: created_at se guarda en UTC; ninguna fecha puede superar la hora
--            actual del servidor en UTC.
-- Esperado:  0 filas.
-- -----------------------------------------------------------------------------
SELECT id, email, created_at
FROM customers
WHERE created_at > UTC_TIMESTAMP(3);
