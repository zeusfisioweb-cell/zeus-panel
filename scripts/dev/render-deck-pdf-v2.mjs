#!/usr/bin/env node
import { chromium } from '@playwright/test';
import path from 'node:path';

const HTML = 'file://' + path.resolve('/tmp/zeus-deck/deck-v2.html');
const OUT = '/tmp/zeus-deck/zeus-panel-presentacion-v2.pdf';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(HTML, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'print' });
await page.pdf({
  path: OUT,
  format: 'A4',
  landscape: true,
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
await browser.close();
console.log('pdf →', OUT);
