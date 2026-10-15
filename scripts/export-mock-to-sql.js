#!/usr/bin/env node
/**
 * Exporta el estado actual del mock (GET /customers) a sql/02-data.sql como INSERTs
 * sobre el esquema observado (sql/01-schema-observed.sql).
 *
 * Uso: node scripts/export-mock-to-sql.js [baseUrl]   (por defecto http://localhost:3000)
 */
const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, '..', 'sql', '02-data.sql');

const sqlString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;

// ISO-8601 UTC → DATETIME(3) de MySQL ('2026-10-15 23:19:47.433')
const sqlDatetime = (iso) => sqlString(new Date(iso).toISOString().replace('T', ' ').replace('Z', ''));

async function exportMockToSql(baseUrl = 'http://localhost:3000') {
  const res = await fetch(`${baseUrl}/customers`);
  if (!res.ok) throw new Error(`GET /customers respondió ${res.status}`);
  const customers = await res.json();

  const lines = [
    '-- =============================================================================',
    '-- 02 - Datos (GENERADO por scripts/export-mock-to-sql.js, no editar a mano)',
    `-- Origen: GET ${baseUrl}/customers`,
    `-- Fecha:  ${new Date().toISOString()}`,
    `-- Filas:  ${customers.length}`,
    '-- Los valores se copian tal como los devolvió la API, sin normalizar.',
    '-- =============================================================================',
    '',
    'DELETE FROM customers;',
    '',
    'INSERT INTO customers (id, name, email, status, created_at) VALUES',
    customers
      .map(
        (c) =>
          `  (${Number(c.id)}, ${sqlString(c.name)}, ${sqlString(c.email)}, ${sqlString(c.status)}, ${sqlDatetime(c.created_at)})`
      )
      .join(',\n') + ';',
    '',
  ];

  fs.writeFileSync(OUTPUT, lines.join('\n'), 'utf8');
  return { file: OUTPUT, customers };
}

module.exports = { exportMockToSql };

if (require.main === module) {
  exportMockToSql(process.argv[2])
    .then(({ file, customers }) => console.log(`${customers.length} clientes exportados a ${path.relative(process.cwd(), file)}`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
