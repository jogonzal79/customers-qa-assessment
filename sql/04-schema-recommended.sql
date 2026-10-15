-- =============================================================================
-- 04 - Esquema RECOMENDADO
-- -----------------------------------------------------------------------------
-- Previene en la base de datos los problemas que detectan las consultas de 03:
--
-- * Email único sin distinguir mayúsculas: columna generada
--   email_normalized = LOWER(TRIM(email)) con UNIQUE y collation binaria.
--   Se prefiere a UNIQUE(email) con utf8mb4_0900_ai_ci porque esa collation
--   también ignora tildes ('jose@' = 'josé@'), una regla más amplia de lo que
--   pide el negocio.
--
-- * Status solo del catálogo, respetando mayúsculas: VARCHAR con collation
--   binaria y CHECK. No se usa ENUM porque MySQL convierte en silencio 'active'
--   en 'ACTIVE' (las comparaciones de ENUM no distinguen mayúsculas con la
--   collation por defecto). Eso ocultaría el error de validación de la API en
--   lugar de rechazarlo.
--
-- * name no vacío: CHECK sobre TRIM(name).
--
-- Requiere MySQL 8.0.16 o superior (los CHECK se aplican desde esa versión).
-- =============================================================================

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
