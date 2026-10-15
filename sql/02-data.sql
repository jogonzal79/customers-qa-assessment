-- =============================================================================
-- 02 - Datos (GENERADO por scripts/export-mock-to-sql.js, no editar a mano)
-- Origen: GET http://localhost:3000/customers
-- Fecha:  2026-10-15T23:42:52.981Z
-- Filas:  7
-- Los valores se copian tal como los devolvió la API, sin normalizar.
-- =============================================================================

DELETE FROM customers;

INSERT INTO customers (id, name, email, status, created_at) VALUES
  (1, 'Juan Pérez', 'juan.perez@example.com', 'ACTIVE', '2026-01-10 09:00:00.000'),
  (2, 'María García', 'maria.garcia@example.com', 'ACTIVE', '2026-02-14 11:30:00.000'),
  (3, 'Carlos López', 'carlos.lopez@example.com', 'PENDING', '2026-03-01 15:45:00.000'),
  (4, 'Ana Martínez', 'ana.martinez@example.com', 'BLOCKED', '2026-04-20 08:15:00.000'),
  (5, 'Luis Rodríguez', 'luis.rodriguez@example.com', 'PENDING', '2026-05-05 17:00:00.000'),
  (6, 'Cliente QA Automatización', 'qa.auto.1792107772592.8520@example.com', 'active', '2026-10-15 23:42:52.610'),
  (7, 'QA Duplicado Mayúsculas', 'QA.AUTO.1792107772592.8520@EXAMPLE.COM', 'PENDING', '2026-10-15 23:42:52.907');
