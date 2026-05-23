#!/usr/bin/env node
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = '/tmp/zeus-deck';
const IMG = path.join(OUT, 'img');
fs.mkdirSync(IMG, { recursive: true });

function loadEnv() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const EMAIL = process.env.PANEL_E2E_EMAIL;
const PASS = process.env.PANEL_E2E_PASSWORD;

const SHOTS = [
  { name: '01_resumen', url: '/', label: 'Resumen del centro' },
  { name: '02_citas', url: '/citas', label: 'Agenda de citas' },
  { name: '03_pacientes', url: '/pacientes', label: 'Pacientes' },
  { name: '04_profesionales', url: '/profesionales', label: 'Profesionales' },
  { name: '05_servicios', url: '/servicios', label: 'Servicios' },
  { name: '06_horarios', url: '/horarios', label: 'Horarios' },
  { name: '07_facturacion', url: '/facturacion', label: 'Facturación' },
  { name: '08_analitica', url: '/analitica', label: 'Analítica' },
  { name: '09_configuracion', url: '/configuracion', label: 'Configuración' },
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

console.log('[deck] login…');
await page.goto(BASE + '/login');
await page.getByLabel('Correo de acceso').fill(EMAIL);
await page.getByLabel(/Contrase[nñ]a/i).fill(PASS);
await page.getByRole('button', { name: 'Entrar al panel' }).click();
await page.waitForURL(/\/$/, { timeout: 30_000 });
await page.getByRole('heading', { name: /Resumen del centro/i }).waitFor({ timeout: 15_000 });
console.log('[deck] logged in');

for (const s of SHOTS) {
  console.log('[deck] →', s.url);
  await page.goto(BASE + s.url, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(2500);
  const out = path.join(IMG, s.name + '.png');
  await page.screenshot({ path: out, fullPage: false });
  console.log('   saved', out);
}

await browser.close();
console.log('[deck] done');
