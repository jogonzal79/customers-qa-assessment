#!/usr/bin/env node
/**
 * Lee el reporte JSON de Playwright (test-results/e2e-results.json) y:
 *   1. Copia a e2e/evidence/<TC>/ el screenshot y el trace.zip de cada test fallido (sin video).
 *   2. Escribe e2e/evidence/summary.json con el resultado de todos los tests.
 *   3. Genera docs/05-e2e-testing.md.
 * No editar el documento a mano: se regenera con `npm run test:e2e`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPORT = path.join(ROOT, 'test-results', 'e2e-results.json');
const EVIDENCE_DIR = path.join(ROOT, 'e2e', 'evidence');
const DOC = path.join(ROOT, 'docs', '05-e2e-testing.md');
const COPIED = { screenshot: 'screenshot.png', trace: 'trace.zip' };

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\s*\r?\n\s*/g, ' ');

function collectSpecs(suite, acc = []) {
  for (const spec of suite.specs || []) acc.push(spec);
  for (const child of suite.suites || []) collectSpecs(child, acc);
  return acc;
}

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const specs = report.suites.flatMap((s) => collectSpecs(s));

fs.rmSync(EVIDENCE_DIR, { recursive: true, force: true });
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const tests = specs.map((spec) => {
  const t = spec.tests[0];
  const result = t.results[t.results.length - 1];
  const annotations = result.annotations && result.annotations.length ? result.annotations : t.annotations;
  const ann = (type) => annotations.filter((a) => a.type === type).map((a) => a.description);
  const tc = ann('tc')[0] || '';
  const passed = t.status === 'expected';

  const evidence = {};
  if (!passed) {
    const dir = path.join(EVIDENCE_DIR, tc || spec.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const a of result.attachments) {
      if (COPIED[a.name] && a.path && fs.existsSync(a.path)) {
        const target = path.join(dir, COPIED[a.name]);
        fs.copyFileSync(a.path, target);
        evidence[a.name] = rel(target);
      }
    }
  }

  const error = result.errors && result.errors[0] ? stripAnsi(result.errors[0].message) : null;
  return {
    tc,
    title: spec.title,
    tags: spec.tags.map((x) => `@${x}`),
    location: `tests/e2e/${spec.file}:${spec.line}`,
    status: passed ? 'passed' : result.status,
    durationMs: Math.round(result.duration),
    risk: ann('risk')[0] || null,
    apiResponse: ann('api-response')[0] || null,
    uiMessage: ann('ui-message')[0] || null,
    steps: (result.steps || []).map((s) => ({ title: s.title, passed: !s.error })),
    error,
    evidence,
  };
});

const summary = {
  generatedAt: new Date().toISOString(),
  startTime: report.stats.startTime,
  durationMs: Math.round(report.stats.duration),
  totals: {
    tests: tests.length,
    passed: report.stats.expected,
    failed: report.stats.unexpected,
    flaky: report.stats.flaky,
    skipped: report.stats.skipped,
  },
  tests,
};
fs.writeFileSync(path.join(EVIDENCE_DIR, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');

// ------------------------------------------------------------------ documento
const out = [];
const started = summary.startTime.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
const icon = (t) => (t.status === 'passed' ? 'PASS' : '**FAIL**');

out.push('# Parte 5 — Automatización E2E con Playwright', '');
out.push('> **Documento generado automáticamente** por `scripts/generate-e2e-evidence.js` a partir del reporte JSON de');
out.push('> Playwright. No editar a mano: se regenera con `npm run test:e2e`.', '');

out.push('## 1. Ejecución', '');
out.push('| Dato | Valor |');
out.push('|---|---|');
out.push(`| Fecha | ${started} |`);
out.push(`| Duración | ${(summary.durationMs / 1000).toFixed(1)} s |`);
out.push(`| Navegador | Chromium (Playwright ${require('@playwright/test/package.json').version}) |`);
out.push(`| Resultado | ${summary.totals.tests} tests: **${summary.totals.passed} pasan**, **${summary.totals.failed} fallan** |`);
out.push('| Evidencia versionada | `e2e/evidence/` (screenshot y trace de los tests fallidos, `summary.json`) |');
out.push('| Reporte HTML (local) | `playwright-report/` — abrir con `npm run report:e2e` |');
out.push('');

out.push('## 2. Resultados', '');
out.push('| TC-ID | Test | Tags | Resultado | Duración |');
out.push('|---|---|---|:---:|---:|');
for (const t of tests) {
  out.push(`| ${t.tc} | ${cell(t.title)} | ${t.tags.map((x) => `\`${x}\``).join(' ')} | ${icon(t)} | ${(t.durationMs / 1000).toFixed(1)} s |`);
}
out.push('');
out.push('Pasos de cada test (`test.step`):', '');
for (const t of tests) {
  out.push(`- **${t.tc}** (${t.location}): ${t.steps.length ? t.steps.map((s) => `${s.passed ? '✅' : '❌'} ${s.title}`).join(' → ') : 'sin pasos'}`);
}
out.push('');

const failed = tests.filter((t) => t.status !== 'passed');
out.push('## 3. Fallos', '');
if (!failed.length) {
  out.push('No hubo fallos en esta ejecución.', '');
}
for (const t of failed) {
  out.push(`### ${t.title}`, '');
  if (t.risk) out.push(`**Riesgo asociado:** ${t.risk}`, '');
  out.push('| Verificación | Valor observado |');
  out.push('|---|---|');
  if (t.apiResponse) out.push(`| Respuesta de la API | \`${cell(t.apiResponse)}\` |`);
  if (t.uiMessage) out.push(`| Mensaje en la UI | \`${cell(t.uiMessage)}\` |`);
  for (const s of t.steps) out.push(`| Paso: ${cell(s.title)} | ${s.passed ? '✅ cumple' : '❌ no cumple'} |`);
  out.push('');
  if (t.apiResponse && t.uiMessage) {
    out.push('La API rechazó el alta correctamente (409), pero la interfaz mostró el mensaje de éxito: el defecto está en el');
    out.push('frontend, que no verifica el resultado de la petición antes de informar al usuario.', '');
  }
  out.push('**Assertion que falló:**', '');
  out.push('```text', (t.error || '').split('\n').filter((l) => !/^\s+at /.test(l)).join('\n').trim(), '```', '');
  out.push('**Evidencia:**', '');
  if (t.evidence.screenshot) out.push(`- Screenshot: [\`${t.evidence.screenshot}\`](../${t.evidence.screenshot})`, '', `  ![Screenshot del fallo ${t.tc}](../${t.evidence.screenshot})`, '');
  if (t.evidence.trace) out.push(`- Trace: [\`${t.evidence.trace}\`](../${t.evidence.trace})`);
  out.push('- El video del fallo queda solo en el reporte local (`test-results/`), no se versiona.', '');
}

out.push('## 4. Cómo abrir el trace', '');
out.push('El trace contiene cada acción, el DOM antes y después, las peticiones de red y la consola del navegador.', '');
out.push('- **En el navegador, sin instalar nada:** abrir <https://trace.playwright.dev> y arrastrar el archivo `trace.zip`.');
out.push('  El archivo se procesa localmente en el navegador; no se sube a ningún servidor.');
out.push('- **Desde el repo:** `npx playwright show-trace e2e/evidence/TC-20/trace.zip`.', '');

out.push('## 5. Comandos', '');
out.push('| Script | Uso |');
out.push('|---|---|');
out.push('| `npm run test:e2e` | **Comando de referencia.** Ejecuta todos los tests, copia la evidencia y regenera este documento. Termina con código de salida 1 mientras haya fallos, incluido el riesgo conocido TC-20. |');
out.push('| `npm run test:e2e:stable` | **Para CI.** Excluye los tests con tag `@known-risk` (`--grep-invert @known-risk`) para que un riesgo ya reportado no bloquee el pipeline. No reemplaza a `test:e2e`: el riesgo sigue abierto y se verifica con el comando de referencia. |');
out.push('| `npm run test:e2e:headed` | Igual que `test:e2e` pero con el navegador visible (sin regenerar la evidencia). |');
out.push('| `npm run report:e2e` | Abre el reporte HTML de la última ejecución. |');
out.push('');

out.push('## 6. Diseño', '');
out.push('| Aspecto | Decisión |');
out.push('|---|---|');
out.push('| Estructura | Page Object `tests/pages/CustomersPage.ts`; fixtures en `tests/fixtures/test-fixtures.ts` (`customersPage`, `api` y reset automático del mock antes de cada test); cliente API en `tests/support/customers-api.ts`. |');
out.push('| Selectores | Solo `data-testid` del frontend (`getByTestId`). Sin XPath ni selectores por texto. |');
out.push('| Esperas | Cada acción espera la respuesta HTTP que dispara (`waitForResponse`); las verificaciones usan web-first assertions. Sin `waitForTimeout`. |');
out.push('| Independencia | Cada test arranca con los 5 clientes semilla (`POST /__test/reset`). `workers: 1` porque el mock tiene un único estado en memoria. |');
out.push('| Evidencia | `screenshot: only-on-failure`, `video` y `trace: retain-on-failure`; reportes `list`, `html` y `json`. `retries: 0` para que un fallo real no se marque como inestable. |');
out.push('| Test que falla | TC-20 es un test normal con tag `@known-risk` y annotation `risk`. No se usa `test.fail()`, que lo reportaría como exitoso y no guardaría evidencia. |');
out.push('| Servidor | `webServer` levanta el mock con `npm --prefix mock-app start` solo si no está corriendo. |');
out.push('');

out.push('## 7. Riesgos observados', '');
out.push('| ID | Riesgo | Severidad | Detalle | Mitigación en las pruebas |');
out.push('|---|---|:---:|---|---|');
out.push('| R-04 | La UI informa éxito sin verificar la respuesta del POST | Alta | Ver TC-20 en la sección 3. | — (el test lo detecta y falla) |');
out.push('| R-08 | Carrera entre respuestas de la lista | Baja | El frontend no cancela ni ordena las peticiones `GET /customers`. Tras un alta dispara una recarga sin filtro; si el usuario busca enseguida, esa recarga y la búsqueda quedan en vuelo a la vez y, si la recarga llega después, la tabla muestra todos los clientes aunque haya un término de búsqueda escrito. | `CustomersPage.createCustomer` espera la recarga posterior al alta antes de continuar, para que los tests no sean inestables. Recomendación al equipo: cancelar la petición anterior (`AbortController`) o descartar respuestas desactualizadas. |');
out.push('');

fs.writeFileSync(DOC, out.join('\n'), 'utf8');
console.log(`Evidencia E2E: ${summary.totals.passed} pasan, ${summary.totals.failed} fallan → ${rel(EVIDENCE_DIR)}/, ${rel(DOC)}`);
