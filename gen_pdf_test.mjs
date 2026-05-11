import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function toDateEs(v) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y,m,d] = v.split('-');
    return `${d}/${m}/${y}`;
  }
  return v;
}

function normalizeText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'SI' : 'NO';
  return String(v).trim();
}

function splitName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function wrapLines(text, font, size, maxWidth, maxLines) {
  const words = text.replace(/\s+/g,' ').trim().split(' ');
  const lines = []; let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(cand, size) <= maxWidth) { cur = cand; continue; }
    if (cur) { lines.push(cur); if (lines.length >= maxLines) break; }
    cur = w;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

const formData = {
  edad: '35', sexo: 'Mujer', ocupacion: 'Fisioterapeuta',
  motivo_consulta: 'Dolor cervical con irradiación al hombro derecho',
  antecedentes_personales: 'Patología recurrente una vez al semestre refiere la paciente',
  historial_familiar: 'Sin antecedentes relevantes',
  sintomatologia: 'Cefaleas, vértigos, mareos y dificultad de movilidad del cuello y para mover esa región',
  peso: '62 kg', altura: '165 cm', tipo: 'Normal',
  frecuencia_ejercicio: '3 días en semana',
  efectos_lesion: 'Imposibilidad para entrenar y dificultad para trabajar en jornada completa',
  descripcion_sintomas: 'Dolor continuo en región cervical derecha con hormigueo ocasional',
  valoracion_movilidad: 'Pérdida de rotación e inclinación lateral derecha',
  pruebas_diagnosticas: 'No realizadas',
  diagnostico: 'Cervicalgia aguda causada por la postura mantenida en el trabajo',
  tratamiento_recomendado: 'Terapia manual, estiramiento, punción seca y ejercicio referido',
  evolucion: 'A la espera de resultados tras primera sesión'
};

const visitDate = '2026-05-10';
const patientName = 'Ana Martínez';
const { first, last } = splitName(patientName);

const placements = [
  { key: '__visit_date', page: 0, x: 72, y: 722, maxWidth: 280, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'En Torrijos el ', always: true },
  { key: '__first', page: 0, x: 102, y: 672, maxWidth: 220, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'Nombre:', always: true },
  { key: '__last', page: 0, x: 102, y: 659, maxWidth: 300, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'Apellidos:', always: true },
  { key: 'edad', page: 0, x: 102, y: 646, maxWidth: 90, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'Edad:', always: true },
  { key: 'sexo', page: 0, x: 102, y: 634, maxWidth: 180, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'Sexo: ', always: true },
  { key: 'ocupacion', page: 0, x: 102, y: 621, maxWidth: 320, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'Ocupación: ', always: true },
  { key: 'motivo_consulta', page: 0, x: 72, y: 571, maxWidth: 460, size: 9.5, lh: 10.5, maxLines: 3, clear: 38 },
  { key: 'antecedentes_personales', page: 0, x: 72, y: 497, maxWidth: 460, size: 9.5, lh: 10.5, maxLines: 2, clear: 28 },
  { key: 'historial_familiar', page: 0, x: 72, y: 452, maxWidth: 460, size: 10, lh: 11, maxLines: 1, clear: 14 },
  { key: 'sintomatologia', page: 0, x: 72, y: 405, maxWidth: 460, size: 9.5, lh: 10.5, maxLines: 5, clear: 62 },
  { key: 'peso', page: 0, x: 102, y: 341, maxWidth: 120, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'Peso:', always: true },
  { key: 'altura', page: 0, x: 102, y: 329, maxWidth: 120, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'Altura:', always: true },
  { key: 'tipo', page: 0, x: 102, y: 316, maxWidth: 220, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'Tipo:', always: true },
  { key: 'frecuencia_ejercicio', page: 0, x: 102, y: 303, maxWidth: 430, size: 10, lh: 11, maxLines: 1, clear: 14, prefix: 'Frecuencia de ejercicio físico: ', always: true },
  { key: 'efectos_lesion', page: 0, x: 72, y: 244, maxWidth: 460, size: 9.5, lh: 10.5, maxLines: 3, clear: 38 },
  { key: 'descripcion_sintomas', page: 0, x: 72, y: 186, maxWidth: 460, size: 9.5, lh: 10.5, maxLines: 3, clear: 38 },
  { key: 'valoracion_movilidad', page: 0, x: 72, y: 140, maxWidth: 460, size: 9.5, lh: 10.5, maxLines: 2, clear: 28 },
  { key: 'pruebas_diagnosticas', page: 0, x: 72, y: 93, maxWidth: 460, size: 10, lh: 11, maxLines: 1, clear: 14 },
  { key: 'diagnostico', page: 1, x: 72, y: 739, maxWidth: 460, size: 9.5, lh: 10.5, maxLines: 2, clear: 30 },
  { key: 'tratamiento_recomendado', page: 1, x: 72, y: 691, maxWidth: 460, size: 9.5, lh: 10.5, maxLines: 2, clear: 30 },
  { key: 'evolucion', page: 1, x: 72, y: 644, maxWidth: 460, size: 9.5, lh: 10.5, maxLines: 2, clear: 30 },
];

const templatePath = path.join(__dirname, 'public', 'consentimientos', 'historia_clinica_fisioterapeutica_original.pdf');
const pdfDoc = await PDFDocument.load(readFileSync(templatePath));
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

for (const p of placements) {
  const page = pdfDoc.getPage(p.page);
  if (p.clear) {
    page.drawRectangle({ x: p.x-2, y: p.y-2, width: p.maxWidth+4, height: p.clear, color: rgb(1,1,1), borderWidth: 0 });
  }
  let val = '';
  if (p.key === '__visit_date') val = toDateEs(visitDate);
  else if (p.key === '__first') val = first;
  else if (p.key === '__last') val = last;
  else val = normalizeText(formData[p.key]);
  
  if (!val && !p.always) continue;
  const full = `${p.prefix ?? ''}${val}`;
  if (!full.trim()) continue;
  const lines = wrapLines(full, font, p.size, p.maxWidth, p.maxLines);
  if (!lines.length) continue;
  page.drawText(lines.join('\n'), { x: p.x, y: p.y, font, size: p.size, lineHeight: p.lh, maxWidth: p.maxWidth, color: rgb(0,0,0) });
}

const out = await pdfDoc.save();
writeFileSync('/tmp/test_historia_clinica.pdf', Buffer.from(out));
console.log('PDF saved:', out.length, 'bytes to /tmp/test_historia_clinica.pdf');
