#!/usr/bin/env node
/**
 * Parte 4 — Validación en MySQL. Ejecuta el flujo completo y genera la evidencia:
 *
 *   1. Reset del mock (POST /__test/reset).
 *   2. Ejecuta la colección de Postman con Newman (sin reporters de archivo: no toca la
 *      evidencia de la Parte 2). Crea y modifica clientes: TC-01, TC-05, TC-09, TC-12.
 *   3. Exporta el estado del mock a sql/02-data.sql.
 *   4. Carga esquema y datos en MySQL (docker compose) y ejecuta las consultas y las
 *      pruebas del esquema recomendado. Guarda la salida en sql/evidence/.
 *   5. Genera docs/04-mysql-validation.md.
 *
 * Requisitos: mock en ejecución (npm run mock) y MySQL levantado (npm run db:up).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const newman = require('newman');
const { exportMockToSql } = require('./export-mock-to-sql');

const ROOT = path.join(__dirname, '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SQL_DIR = path.join(ROOT, 'sql');
const EVIDENCE_DIR = path.join(SQL_DIR, 'evidence');
const DOC = path.join(ROOT, 'docs', '04-mysql-validation.md');
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ---------------------------------------------------------------- MySQL
function mysql(sql) {
  const r = spawnSync(
    'docker',
    ['compose', 'exec', '-T', '-e', 'MYSQL_PWD=qa', 'mysql',
     'mysql', '-uqa', '--default-character-set=utf8mb4', '--table', 'customers_qa'],
    { cwd: ROOT, input: Buffer.from(sql, 'utf8'), encoding: 'utf8' }
  );
  if (r.error) throw r.error;
  return { ok: r.status === 0, stdout: r.stdout.replace(/\r/g, '').trimEnd(), stderr: r.stderr.replace(/\r/g, '').trim() };
}

function mysqlOrDie(sql, what) {
  const r = mysql(sql);
  if (!r.ok) throw new Error(`Falló ${what}:\n${r.stderr}`);
  return r;
}

const readSql = (file) => fs.readFileSync(path.join(SQL_DIR, file), 'utf8');

/**
 * Separa un archivo en pasos usando los encabezados "-- Qn. Título" / "-- Tn. Título".
 * Cada paso conserva sus comentarios (propósito / esperado) y su SQL.
 */
function parseSteps(content) {
  const steps = [];
  let current = null;
  for (const line of content.split(/\r?\n/)) {
    const h = line.match(/^-- ((?:Q|T)\d+)\. (.+)$/);
    if (h) {
      current = { id: h[1], title: h[2].trim(), comments: [], sql: [] };
      steps.push(current);
      continue;
    }
    if (!current) continue;
    if (/^-- -{10,}/.test(line)) continue;
    if (line.startsWith('--')) current.comments.push(line.replace(/^--\s?/, ''));
    else current.sql.push(line);
  }
  return steps.map((s) => {
    const text = s.comments.join('\n');
    const pick = (label) => {
      const m = text.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\S[^\\n]*:\\s|$)`));
      return m ? m[1].replace(/\s*\n\s*/g, ' ').trim() : '';
    };
    return { ...s, purpose: pick('Propósito'), expected: pick('Esperado'), sql: s.sql.join('\n').trim() };
  });
}

const countRows = (table) => Math.max(0, table.split('\n').filter((l) => l.startsWith('|')).length - 1);

// ---------------------------------------------------------------- Newman
function runCollection() {
  return new Promise((resolve, reject) => {
    newman.run(
      {
        collection: path.join(ROOT, 'postman', 'customers-api.postman_collection.json'),
        environment: path.join(ROOT, 'postman', 'local.postman_environment.json'),
        envVar: [{ key: 'baseUrl', value: BASE_URL }],
        reporters: [],
      },
      (err, summary) => (err ? reject(err) : resolve(summary))
    );
  });
}

// ---------------------------------------------------------------- main
async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  console.log('1/5 Reset del mock');
  const reset = await fetch(`${BASE_URL}/__test/reset`, { method: 'POST' });
  if (reset.status !== 204) throw new Error(`Reset respondió ${reset.status}`);

  console.log('2/5 Ejecutando la colección de Postman (Newman)');
  const summary = await runCollection();
  // Newman no expone en el resumen las variables modificadas durante la ejecución:
  // el cliente de referencia se toma de la respuesta real del alta de TC-01.
  const createExec = summary.run.executions.find((e) => /\[TC-01\]/.test(e.item.parent().name));
  if (!createExec || !createExec.response) throw new Error('No se encontró la respuesta del alta de TC-01');
  const created = JSON.parse(createExec.response.stream.toString('utf8'));
  const email = created.email;
  const customerId = created.id;
  const asserts = summary.run.stats.assertions;
  const failedTests = summary.run.failures.map((f) => `${f.source.name}: ${f.error.test}`);
  console.log(`    ${summary.run.stats.requests.total} requests, ${asserts.total} asserts, ${asserts.failed} fallidos. Email TC-01: ${email}`);

  console.log('3/5 Exportando el estado del mock a sql/02-data.sql');
  const { customers } = await exportMockToSql(BASE_URL);

  console.log('4/5 Cargando datos y ejecutando consultas en MySQL');
  const version = mysqlOrDie('SELECT VERSION() AS version;', 'SELECT VERSION()').stdout.split('\n')[3].replace(/[|\s]/g, '');
  mysqlOrDie(readSql('01-schema-observed.sql') + '\n' + readSql('02-data.sql'), 'la carga del esquema observado');
  const loaded = mysqlOrDie('SELECT COUNT(*) AS filas FROM customers;', 'el conteo').stdout;

  // Consultas de validación
  const setEmail = `SET @email = '${email.replace(/'/g, "''")}';\n`;
  const queries = parseSteps(readSql('03-validation-queries.sql')).map((q) => {
    const r = mysqlOrDie(setEmail + q.sql, q.id);
    return { ...q, output: r.stdout, rows: countRows(r.stdout) };
  });

  // Evaluación automática contra el resultado esperado
  const statusOf = (out) => {
    const row = out.split('\n').find((l) => /^\|\s*\d/.test(l));
    return row ? row.split('|').map((c) => c.trim())[3] : null;
  };
  const checks = {
    Q1: (q) => ({ ok: q.rows === 1, got: `${q.rows} fila(s)` }),
    Q2: (q) => ({ ok: q.rows === 1 && statusOf(q.output) === 'BLOCKED', got: `status = '${statusOf(q.output)}'` }),
    Q3: (q) => ({ ok: q.rows === 0, got: `${q.rows} grupo(s) duplicado(s)` }),
    Q4: (q) => ({ ok: q.rows === 5, got: `${q.rows} fila(s)` }),
    Q5: (q) => ({ ok: q.rows === 0, got: `${q.rows} fila(s)` }),
    Q6: (q) => ({ ok: q.rows === 0, got: `${q.rows} fila(s)` }),
    Q7: (q) => ({ ok: q.rows === 0, got: `${q.rows} fila(s)` }),
  };
  for (const q of queries) Object.assign(q, checks[q.id](q));

  // Pruebas del esquema recomendado
  const outOfCatalog = customers.find((c) => !['ACTIVE', 'PENDING', 'BLOCKED'].includes(c.status));
  const firstByEmail = {};
  const duplicate = customers.find((c) => {
    const k = c.email.trim().toLowerCase();
    if (firstByEmail[k]) return true;
    firstByEmail[k] = c.id;
    return false;
  });
  mysqlOrDie(readSql('04-schema-recommended.sql'), 'la creación del esquema recomendado');
  const setIds =
    `SET @status_customer_id = ${outOfCatalog ? outOfCatalog.id : 'NULL'};\n` +
    `SET @duplicate_id = ${duplicate ? duplicate.id : 'NULL'};\n`;
  const expectations = { T1: 'OK', T2: 'ERROR 3819', T3: 'OK', T4: 'ERROR 1062', T5: 'OK', T6: 'OK' };
  // T5 usa una tabla temporal: se ejecuta en una sola sesión.
  const tests = parseSteps(readSql('05-recommended-schema-tests.sql')).map((t) => {
    const r = mysql(setIds + t.sql);
    const errorCode = (r.stderr.match(/ERROR (\d+)/) || [])[1];
    const got = r.ok ? 'OK' : `ERROR ${errorCode}`;
    return { ...t, output: r.ok ? r.stdout : r.stderr, got, want: expectations[t.id], ok: got === expectations[t.id] };
  });

  // Evidencia en texto plano
  const evidence = (title, items, fmt) =>
    [`# ${title}`, `# Generado: ${new Date().toISOString()} · MySQL ${version}`, ''].concat(items.flatMap(fmt)).join('\n') + '\n';
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, '03-validation-queries.txt'),
    evidence('Consultas de validación (esquema observado)', queries, (q) => [
      `-- ${q.id}. ${q.title}`, setEmail.trim(), q.sql, '', q.output || 'Empty set (0 filas)', '',
    ]),
    'utf8'
  );
  fs.writeFileSync(
    path.join(EVIDENCE_DIR, '05-recommended-schema-tests.txt'),
    evidence('Pruebas del esquema recomendado', tests, (t) => [
      `-- ${t.id}. ${t.title}`, setIds.trim(), t.sql, '', t.output || `${t.got} (sin filas de salida)`, '',
    ]),
    'utf8'
  );

  console.log('5/5 Generando docs/04-mysql-validation.md');
  writeDoc({ version, email, customerId, customers, loaded, queries, tests, asserts, failedTests, outOfCatalog, duplicate });

  console.log('\nResumen');
  for (const q of queries) console.log(`  ${q.id} ${q.ok ? 'CUMPLE   ' : 'NO CUMPLE'} ${q.title} → ${q.got}`);
  for (const t of tests) console.log(`  ${t.id} ${t.ok ? 'OK  ' : 'FAIL'} ${t.title} → esperado ${t.want}, obtenido ${t.got}`);
}

// ---------------------------------------------------------------- documento
function writeDoc(d) {
  const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
  const block = (lang, s) => ['```' + lang, s, '```'];
  const out = [];
  const ts = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

  out.push('# Parte 4 — Validación en MySQL', '');
  out.push('> **Documento generado automáticamente** por `scripts/run-sql-validation.js`. No editar a mano:');
  out.push('> para regenerarlo, ejecutar `npm run db:up` y luego `npm run report:sql` con el mock en ejecución.', '');

  out.push('## 1. Enfoque', '');
  out.push('La aplicación de referencia no incluye base de datos, así que el estado que deja la API se lleva a un MySQL real');
  out.push('en Docker y se valida con consultas SQL. Se usan dos esquemas:', '');
  out.push('| Esquema | Archivo | Para qué |');
  out.push('|---|---|---|');
  out.push('| `customers` (observado) | `sql/01-schema-observed.sql` | Guarda los datos **tal como los dejó la API**, sin restricciones que los corrijan o rechacen. Sobre él corren las consultas Q1–Q7. |');
  out.push('| `customers_recommended` | `sql/04-schema-recommended.sql` | Esquema propuesto que **impide** en la BD los problemas detectados. Se prueba cargando las mismas filas (T1–T6). |');
  out.push('');
  out.push('Con el esquema supuesto en la Parte 1 (S-09: `UNIQUE(email)` con `utf8mb4_0900_ai_ci` y status `ENUM`) los datos');
  out.push('problemáticos no podrían cargarse tal cual: el duplicado se rechazaría y `\'active\'` se guardaría como `\'ACTIVE\'`.');
  out.push('Por eso se separa la **detección** (esquema observado) de la **prevención** (esquema recomendado).', '');

  out.push('## 2. Ejecución', '');
  out.push('| Dato | Valor |');
  out.push('|---|---|');
  out.push(`| Fecha | ${ts} |`);
  out.push(`| Motor | MySQL ${d.version} (\`docker-compose.yml\`, servicio \`mysql\`, puerto 3307) |`);
  out.push(`| Operaciones previas por API | Colección de Postman (Parte 2) ejecutada con Newman tras un reset: ${d.asserts.total} asserts, ${d.asserts.failed} fallidos (los riesgos conocidos R1–R3). Incluye TC-01 (alta), TC-05 (cambio a BLOCKED), TC-09 (alta con email en mayúsculas) y TC-12 (status \`active\`). |`);
  out.push(`| Cliente de referencia (TC-01) | id ${d.customerId}, \`${d.email}\` |`);
  out.push(`| Datos cargados | \`sql/02-data.sql\`, generado desde \`GET /customers\`: ${d.customers.length} filas |`);
  out.push(`| Evidencia en texto plano | \`sql/evidence/03-validation-queries.txt\`, \`sql/evidence/05-recommended-schema-tests.txt\` |`);
  out.push('');
  out.push('Datos cargados en `customers`:', '');
  out.push('| id | name | email | status | created_at (UTC) |');
  out.push('|:---:|---|---|---|---|');
  for (const c of d.customers) out.push(`| ${c.id} | ${cell(c.name)} | ${cell(c.email)} | \`${cell(c.status)}\` | ${c.created_at} |`);
  out.push('');

  out.push('## 3. Consultas de validación (esquema observado)', '');
  out.push('Archivo: `sql/03-validation-queries.sql`. Los emails se comparan con `LOWER(TRIM(email))` y el status con');
  out.push('`COLLATE utf8mb4_bin` (comparación binaria, equivalente a `BINARY` sin el operador obsoleto desde MySQL 8.0.27).', '');
  out.push('| ID | Consulta | Esperado | Obtenido | Resultado |');
  out.push('|---|---|---|---|:---:|');
  for (const q of d.queries) out.push(`| ${q.id} | ${cell(q.title)} | ${cell(q.expected)} | ${cell(q.got)} | ${q.ok ? 'CUMPLE' : '**NO CUMPLE**'} |`);
  out.push('');
  for (const q of d.queries) {
    out.push(`### ${q.id}. ${q.title}`, '');
    if (q.purpose) out.push(`**Propósito:** ${q.purpose}`, '');
    out.push(`**Esperado:** ${q.expected}`, '');
    out.push(...block('sql', q.sql), '');
    out.push('**Salida real:**', '');
    out.push(...block('text', q.output || 'Empty set (0 filas)'), '');
    out.push(`**Resultado:** ${q.ok ? 'CUMPLE' : '**NO CUMPLE**'} — ${q.got}.`, '');
  }

  out.push('## 4. Esquema recomendado', '');
  out.push(...block('sql', readSql('04-schema-recommended.sql').split('\n').filter((l) => !l.startsWith('--')).join('\n').trim()), '');
  out.push('| Regla | Implementación | Por qué |');
  out.push('|---|---|---|');
  out.push('| Email único sin distinguir mayúsculas | Columna generada `email_normalized = LOWER(TRIM(email))` con `UNIQUE` y collation binaria | `UNIQUE(email)` con `utf8mb4_0900_ai_ci` también ignora tildes, una regla más amplia de lo que pide el negocio |');
  out.push('| Status solo del catálogo | `VARCHAR(10)` con collation `utf8mb4_bin` y `CHECK (status IN (...))` | Un `ENUM` convierte `\'active\'` en `\'ACTIVE\'` sin error (T5) y oculta la falla de validación de la API |');
  out.push('| name no vacío | `CHECK (TRIM(name) <> \'\')` | Refuerza en la BD la regla de la API |');
  out.push('');
  out.push('### Pruebas (`sql/05-recommended-schema-tests.sql`)', '');
  out.push(`Variables: \`@status_customer_id = ${d.outOfCatalog ? d.outOfCatalog.id : 'NULL'}\` (status fuera de catálogo), \`@duplicate_id = ${d.duplicate ? d.duplicate.id : 'NULL'}\` (email duplicado en mayúsculas).`, '');
  out.push('| ID | Prueba | Esperado | Obtenido | Resultado |');
  out.push('|---|---|---|---|:---:|');
  for (const t of d.tests) out.push(`| ${t.id} | ${cell(t.title)} | ${t.want} | ${t.got} | ${t.ok ? 'OK' : '**FAIL**'} |`);
  out.push('');
  for (const t of d.tests) {
    out.push(`#### ${t.id}. ${t.title}`, '');
    out.push(...block('sql', t.sql), '');
    out.push('**Salida real:**', '');
    out.push(...block('text', t.output || `${t.got} (sin filas de salida)`), '');
  }

  out.push('## 5. Conclusiones', '');
  const failed = d.queries.filter((q) => !q.ok);
  if (failed.length) {
    out.push(`Las consultas detectan ${failed.length} incumplimiento(s) sobre los datos que dejó la API: ${failed.map((q) => `${q.id} (${q.got})`).join(', ')}.`);
    out.push('Corresponden a los riesgos R-01 (email duplicado con otras mayúsculas, TC-09) y R-02 (status fuera del catálogo, TC-12)');
    out.push('ya detectados por API en la Parte 2. La base de datos confirma que esos datos quedan **persistidos**.', '');
  } else {
    out.push('Las consultas no detectaron incumplimientos en los datos cargados.', '');
  }
  const prevented = d.tests.filter((t) => t.want.startsWith('ERROR') && t.ok);
  out.push(`El esquema recomendado rechaza ${prevented.length} de ${d.tests.filter((t) => t.want.startsWith('ERROR')).length} filas problemáticas (${prevented.map((t) => `${t.id}: ${t.got}`).join(', ')}).`);
  out.push('Esto actualiza el supuesto S-09 de la Parte 1: para el status se recomienda `CHECK` con collation binaria en lugar de `ENUM`.');
  out.push('Como señala la observación de TC-09, la API debe traducir el error 1062 a **409** y no a 500.', '');

  fs.writeFileSync(DOC, out.join('\n'), 'utf8');
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
