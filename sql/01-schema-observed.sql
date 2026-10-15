-- =============================================================================
-- 01 - Esquema OBSERVADO
-- -----------------------------------------------------------------------------
-- Refleja fielmente lo que la API dejó guardado, sin corregir ni rechazar nada:
--   * email con collation binaria (distingue mayúsculas, igual que la API) e
--     índice NO único, para poder cargar duplicados que difieren en mayúsculas.
--   * status como VARCHAR sin restricción, para conservar valores fuera del
--     catálogo tal como los guardó la API (por ejemplo 'active').
-- Sobre este esquema se ejecutan las consultas de validación (03).
-- El esquema que previene estos problemas está en 04-schema-recommended.sql.
-- =============================================================================

DROP TABLE IF EXISTS customers;

CREATE TABLE customers (
  id          INT UNSIGNED NOT NULL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  status      VARCHAR(20)  NOT NULL,
  created_at  DATETIME(3)  NOT NULL,
  INDEX ix_customers_email (email),
  INDEX ix_customers_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
