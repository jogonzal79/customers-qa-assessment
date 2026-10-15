#!/usr/bin/env node
/**
 * Ejecuta Playwright y, haya o no fallos, copia la evidencia y regenera docs/05-e2e-testing.md.
 * Termina con el mismo código de salida que Playwright.
 * Los argumentos adicionales se pasan a `playwright test`.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const cli = require.resolve('@playwright/test/cli');

const run = spawnSync(process.execPath, [cli, 'test', ...process.argv.slice(2)], { cwd: ROOT, stdio: 'inherit' });

const evidence = spawnSync(process.execPath, [path.join(__dirname, 'generate-e2e-evidence.js')], { cwd: ROOT, stdio: 'inherit' });
if (evidence.status !== 0) console.error('No se pudo generar la evidencia E2E.');

process.exit(run.status ?? 1);
