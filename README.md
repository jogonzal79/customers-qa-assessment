# Customers QA Assessment

Assessment técnico de QA Automation sobre una aplicación de gestión de clientes: frontend web, API REST y MySQL.

> [!NOTE]
> **Entorno simulado.** Por indicación del cliente, la prueba se resolvió sobre un escenario 100 % simulado. A partir
> de la especificación se construyó un mock local (API, frontend y Swagger) con defectos introducidos intencionalmente,
> documentados en [`mock-app/README.md`](mock-app/README.md) y [`mock-app/defects.config.js`](mock-app/defects.config.js),
> para que los hallazgos sean reproducibles y verificables. Los documentos de análisis están escritos como si se
> probara un sistema de terceros.

## Entregables

| Parte | Entregable | Ubicación |
|---|---|---|
| 1 | Diseño de casos de prueba | [`docs/01-test-cases.md`](docs/01-test-cases.md) |
| 2 | Testing de API | [`docs/02-api-testing.md`](docs/02-api-testing.md) · [`postman/`](postman/) (colección, environment, cURL, reportes) |
| 3 | Revisión de Swagger/OpenAPI | [`docs/03-swagger-review.md`](docs/03-swagger-review.md) |
| 4 | Validación en MySQL | [`docs/04-mysql-validation.md`](docs/04-mysql-validation.md) · [`sql/`](sql/) |
| 5 | Automatización E2E | [`docs/05-e2e-testing.md`](docs/05-e2e-testing.md) · [`tests/`](tests/) · [`e2e/evidence/`](e2e/evidence/) |
| 6 | Investigación de bug | [`docs/06-bug-investigation.md`](docs/06-bug-investigation.md) |
| 7 | Reporte de defecto | [`docs/07-defect-report.md`](docs/07-defect-report.md) |
| — | Mock de la aplicación | [`mock-app/`](mock-app/) |

## Requisitos previos

- **Node.js ≥ 20** (lo exige Playwright; el mock por sí solo funciona con Node 18).
- **Git**.
- **Docker Desktop**, solo para la Parte 4 (MySQL).

## Instalación y ejecución

```bash
npm install                     # herramientas de prueba (Newman, Playwright, TypeScript)
npm --prefix mock-app install   # dependencias del mock
npx playwright install chromium # navegador para la Parte 5

npm run mock                    # en otra terminal: http://localhost:3000  (Swagger en /docs)
```

| Parte | Comando | Requiere |
|---|---|---|
| 2 · API | `npm run test:api` — ejecuta la colección con Newman<br>`npm run report:api` — ejecuta y regenera la evidencia (`postman/reports/`, `docs/02`) | Mock en ejecución |
| 4 · SQL | `npm run db:up` → `npm run report:sql` → `npm run db:down` (limpieza) | Mock en ejecución y Docker |
| 5 · E2E | `npm run test:e2e` — **comando de referencia**; copia la evidencia y regenera `docs/05`<br>`npm run test:e2e:stable` — para CI, excluye los riesgos conocidos (`@known-risk`)<br>`npm run report:e2e` — abre el reporte HTML | Levanta el mock si no está corriendo |

Los comandos `report:api`, `report:sql` y `test:e2e` **regeneran la evidencia versionada** (documentos y reportes).
Para volver a la versión del repo: `git restore .`

## Resultados esperados

Algunas pruebas **fallan a propósito**: el resultado esperado sigue la especificación y detecta defectos reales del
sistema bajo prueba. `npm run test:api` y `npm run test:e2e` terminan con código de salida 1 por ese motivo.

| Defecto | Descripción | Dónde falla | Estado |
|---|---|---|---|
| [BUG-001](docs/07-defect-report.md) | La UI muestra "Cliente creado correctamente" cuando la API rechaza el alta (409/400) | E2E: TC-20 | Confirmado |
| BUG-002 | La API acepta un email duplicado que difiere solo en mayúsculas | Newman: R1 (TC-09) · SQL: Q1, Q3 | Confirmado |
| BUG-003 | `PATCH /status` acepta y guarda valores fuera del catálogo (`active`) | Newman: R2 (TC-12) · SQL: Q2, Q5 | Confirmado |
| BUG-004 | El contrato OpenAPI documenta 200 para el alta; la API responde 201 | Newman: R3 (TC-14) | Confirmado |
| BUG-005 | Posible carrera entre respuestas de la lista de clientes | — (análisis de código) | Riesgo potencial, no reproducido |

Resumen de una ejecución normal:

- **Newman:** 62 asserts, 8 fallan (todos en R1, R2 y R3).
- **SQL:** Q1, Q2, Q3 y Q5 "no cumplen"; el esquema recomendado rechaza las filas problemáticas (T2: error 3819, T4: error 1062).
- **Playwright:** 3 pasan, 1 falla (TC-20) con screenshot y trace en `e2e/evidence/`.

## Estructura

```
├── mock-app/          Mock de la aplicación (API Express, frontend, OpenAPI, defects.config.js)
├── docs/              Documentos de las Partes 1 a 7
├── postman/           Colección, environment, bodies y comandos cURL, reportes de Newman
├── sql/               Esquemas, datos, consultas y evidencia de MySQL
├── tests/             Suite Playwright (specs, Page Object, fixtures)
├── e2e/evidence/      Evidencia versionada de los tests E2E fallidos
├── scripts/           Generadores de evidencia y documentos
├── docker-compose.yml MySQL 8.4 para la Parte 4
└── playwright.config.ts
```

## Herramientas

Node.js, Express, Swagger UI, Postman/Newman, MySQL 8.4 (Docker), Playwright con TypeScript. El desarrollo se apoyó
en Claude Code como asistente.
