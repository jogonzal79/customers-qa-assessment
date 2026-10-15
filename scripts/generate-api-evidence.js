#!/usr/bin/env node
/**
 * Genera docs/02-api-testing.md a partir del reporte JSON de Newman.
 * No edites el documento a mano: vuelve a ejecutar `npm run report:api`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'postman', 'reports', 'newman-report.json');
const OUTPUT = path.join(ROOT, 'docs', '02-api-testing.md');
const MAX_BODY = 220;

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const { run, collection } = report;

// item id → nombre de carpeta
const folderOf = {};
for (const folder of collection.item) {
  for (const item of folder.item || []) folderOf[item.id] = folder.name;
}

const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ');
const code = (text) => (text ? '`' + cell(text).replace(/`/g, "'") + '`' : '—');

function parseMeta(description) {
  const content = typeof description === 'string' ? description : (description && description.content) || '';
  const get = (key) => {
    const m = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1].trim() : '';
  };
  return { tc: get('TC'), expected: get('Esperado') };
}

function compactJson(raw) {
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function truncate(text, max = MAX_BODY) {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function urlPath(url) {
  const p = '/' + (url.path || []).join('/');
  const q = (url.query || []).filter((x) => !x.disabled).map((x) => `${x.key}=${x.value}`).join('&');
  return q ? `${p}?${q}` : p;
}

function responseSummary(exec) {
  if (!exec.response || !exec.response.stream) return '(sin respuesta)';
  const raw = Buffer.from(exec.response.stream.data).toString('utf8');
  // El spec OpenAPI completo no entra en una celda: se resume la parte que se valida.
  if (urlPath(exec.request.url).endsWith('/openapi.json')) {
    try {
      const spec = JSON.parse(raw);
      const codes = Object.keys(spec.paths['/customers'].post.responses);
      return `{"paths":{"/customers":{"post":{"responses":[${codes.map((c) => `"${c}"`).join(',')}]}}}} (resumido)`;
    } catch {
      /* cae al resumen genérico */
    }
  }
  return truncate(compactJson(raw));
}

function header(exec, name) {
  const h = (exec.response.header || []).find((x) => x.key.toLowerCase() === name.toLowerCase());
  return h ? h.value : null;
}

const rows = run.executions.map((exec, i) => {
  const meta = parseMeta(exec.item.request.description);
  const failed = exec.assertions.filter((a) => a.error);
  const location = header(exec, 'Location');
  const body = exec.request.body && exec.request.body.raw ? compactJson(exec.request.body.raw) : '';
  return {
    n: i + 1,
    folder: folderOf[exec.item.id] || '',
    name: exec.item.name,
    tc: meta.tc,
    expected: meta.expected,
    method: exec.request.method,
    path: urlPath(exec.request.url),
    body,
    status: exec.response ? `${exec.response.code} ${exec.response.status}` : '—',
    location,
    response: responseSummary(exec),
    assertions: exec.assertions,
    failed,
    result: failed.length ? 'FAIL' : 'PASS',
  };
});

const stats = run.stats;
const totalAsserts = stats.assertions.total;
const failedAsserts = stats.assertions.failed;
const started = new Date(run.timings.started).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
const baseUrl = ((report.environment && report.environment.values) || []).find((v) => v.key === 'baseUrl');

// ---------- Markdown ----------
const out = [];
out.push('# Parte 2 — Testing de API');
out.push('');
out.push('> **Documento generado automáticamente** por `scripts/generate-api-evidence.js` a partir del reporte de Newman');
out.push('> (`postman/reports/newman-report.json`). No editar a mano: para regenerarlo, ejecutar `npm run report:api`.');
out.push('');
out.push('## 1. Ejecución');
out.push('');
out.push('| Dato | Valor |');
out.push('|---|---|');
out.push(`| Fecha de ejecución | ${started} |`);
out.push(`| Colección | \`postman/customers-api.postman_collection.json\` (${collection.info.name}) |`);
out.push(`| Environment | \`postman/local.postman_environment.json\` — \`baseUrl = ${baseUrl ? baseUrl.value : '?'}\` |`);
out.push('| Reporte HTML | `postman/reports/newman-report.html` |');
out.push('| Comandos cURL equivalentes | `postman/curl-commands.md` |');
out.push('');
out.push('### Resumen');
out.push('');
out.push('| Métrica | Total | Pasan | Fallan |');
out.push('|---|:---:|:---:|:---:|');
out.push(`| Requests | ${stats.requests.total} | ${rows.filter((r) => r.result === 'PASS').length} | ${rows.filter((r) => r.result === 'FAIL').length} |`);
out.push(`| Asserts (\`pm.test\`) | ${totalAsserts} | ${totalAsserts - failedAsserts} | ${failedAsserts} |`);
out.push('');
out.push('Un request se marca **FAIL** si al menos uno de sus asserts falla. El resultado esperado sigue la');
out.push('especificación y las buenas prácticas REST (ver `docs/01-test-cases.md`), no el comportamiento observado.');
out.push('');

// Resumen por escenario
out.push('### Resultado por escenario');
out.push('');
out.push('| Escenario | TC-ID | Requests | Asserts OK / total | Resultado |');
out.push('|---|---|:---:|:---:|:---:|');
const folders = [...new Set(rows.map((r) => r.folder))];
for (const f of folders) {
  const fr = rows.filter((r) => r.folder === f);
  const total = fr.reduce((s, r) => s + r.assertions.length, 0);
  const ok = fr.reduce((s, r) => s + r.assertions.length - r.failed.length, 0);
  const tcs = [...new Set(fr.map((r) => r.tc))].join(', ');
  const name = f.replace(/\s*\[TC-\d+\]$/, '');
  out.push(`| ${cell(name)} | ${tcs} | ${fr.length} | ${ok} / ${total} | ${fr.some((r) => r.result === 'FAIL') ? '**FAIL**' : 'PASS'} |`);
}
out.push('');

// Tabla de evidencia
out.push('## 2. Evidencia por prueba');
out.push('');
out.push('| # | TC-ID | Request | Response (resumida) | HTTP | Resultado esperado | Resultado obtenido | Estado |');
out.push('|:---:|---|---|---|:---:|---|---|:---:|');
for (const r of rows) {
  const req = `**${r.method}** \`${cell(r.path)}\`` + (r.body ? `<br>${code(r.body)}` : '');
  const resp = (r.location ? `\`Location: ${cell(r.location)}\`<br>` : '') + code(r.response);
  const obtained = r.failed.length
    ? `${r.status}. Fallan ${r.failed.length} de ${r.assertions.length} asserts: ` +
      r.failed.map((a) => `"${cell(a.assertion)}" (${cell(a.error.message)})`).join('; ')
    : `${r.status}. ${r.assertions.length}/${r.assertions.length} asserts OK`;
  out.push(
    `| ${r.n} | ${r.tc} | ${req} | ${resp} | ${r.status.split(' ')[0]} | ${cell(r.expected)} | ${obtained} | ${r.result === 'FAIL' ? '**FAIL**' : 'PASS'} |`
  );
}
out.push('');

// Detalle de asserts
out.push('## 3. Detalle de asserts');
out.push('');
for (const f of folders) {
  out.push(`### ${f}`);
  out.push('');
  for (const r of rows.filter((x) => x.folder === f)) {
    out.push(`**#${r.n} ${r.name}** — HTTP ${r.status}`);
    out.push('');
    for (const a of r.assertions) {
      out.push(a.error ? `- ❌ ${a.assertion} — _${a.error.message}_` : `- ✅ ${a.assertion}`);
    }
    out.push('');
  }
}

// Hallazgos
const failing = rows.filter((r) => r.result === 'FAIL');
out.push('## 4. Hallazgos');
out.push('');
if (!failing.length) {
  out.push('No se registraron fallos en esta ejecución.');
} else {
  out.push('Requests con resultado distinto al esperado, agrupados por caso de prueba:');
  out.push('');
  out.push('| TC-ID | Escenario | Esperado | Obtenido |');
  out.push('|---|---|---|---|');
  const byTc = {};
  for (const r of failing) (byTc[r.tc] = byTc[r.tc] || []).push(r);
  for (const [tc, rs] of Object.entries(byTc)) {
    for (const r of rs) {
      out.push(`| ${tc} | ${cell(r.folder.replace(/\s*\[TC-\d+\]$/, ''))} — ${cell(r.name)} | ${cell(r.expected)} | ${r.status}: ${r.failed.map((a) => cell(a.error.message)).join('; ')} |`);
    }
  }
}
out.push('');
out.push('## 5. Notas de ejecución');
out.push('');
out.push('- La colección se ejecuta en orden y encadena variables: el alta (`01`) guarda `customerId`, `customerEmail` y');
out.push('  `createStatusCode`, que reutilizan los pasos siguientes. El email del alta es dinámico, por lo que la colección no');
out.push('  necesita datos semilla ni el endpoint de reset y puede ejecutarse contra un entorno real.');
out.push('- La API no expone `DELETE`: si el caso TC-09 falla en un entorno real, el cliente duplicado creado queda registrado y');
out.push('  debe limpiarse por fuera de la colección.');
out.push('- `npm run test:api` ejecuta la misma colección y termina con código de salida distinto de 0 mientras existan fallos,');
out.push('  para que un pipeline de CI lo detecte. `npm run report:api` no corta por fallos para poder generar la evidencia.');
out.push('');

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, out.join('\n'), 'utf8');
console.log(`Evidencia generada en ${path.relative(ROOT, OUTPUT)} (${rows.length} requests, ${totalAsserts} asserts, ${failedAsserts} fallidos)`);
