import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = __dirname;
const OUT = path.join(CWD, 'pdf-verification');

const MM = 72 / 25.4;
const PAGE_WIDTH = 595.2756;
const PAGE_HEIGHT = 841.8898;
const MARGIN_X = 16 * MM;
const MARGIN_TOP = 16 * MM;
const HEADER_GAP = 8 * MM;
const HEADER_AFTER_LINE = 7 * MM;
const SECTION_TITLE_GAP = 2.5 * MM;
const SECTION_AFTER_LINE = 4.5 * MM;
const FIELD_LABEL_GAP = 2.5 * MM;
const FIELD_AFTER_LINE = 5.5 * MM;
const AREA_HEIGHT = 16 * MM;
const AREA_AFTER = 4 * MM;
const PAGE_BREAK_THRESHOLD = 55 * MM;
const LINE_TEXT_OFFSET_Y = -4;
const AREA_TEXT_TOP_PADDING = 12;
const HORIZONTAL_TEXT_PADDING = 6;

function headerStartY() {
  return PAGE_HEIGHT - MARGIN_TOP - HEADER_GAP - HEADER_GAP - HEADER_AFTER_LINE;
}
function advanceSectionTitle(y) { return y - SECTION_TITLE_GAP - SECTION_AFTER_LINE; }
function placeLineField(pl, key, page, y) {
  const lineY = y - FIELD_LABEL_GAP;
  pl.push({ key, kind:'line', page, x: MARGIN_X+HORIZONTAL_TEXT_PADDING, y: lineY+LINE_TEXT_OFFSET_Y, maxWidth: PAGE_WIDTH-(2*MARGIN_X)-(2*HORIZONTAL_TEXT_PADDING), fontSize:7, minFontSize:6, lineHeight:8, maxLines:1 });
  return lineY - FIELD_AFTER_LINE;
}
function placeAreaField(pl, key, page, y) {
  const boxTop = y - FIELD_LABEL_GAP;
  pl.push({ key, kind:'area', page, x: MARGIN_X+HORIZONTAL_TEXT_PADDING, y: boxTop-AREA_TEXT_TOP_PADDING, maxWidth: PAGE_WIDTH-(2*MARGIN_X)-(2*HORIZONTAL_TEXT_PADDING), fontSize:8.8, minFontSize:7, lineHeight:10.2, maxLines:4 });
  return boxTop - AREA_HEIGHT - AREA_AFTER;
}
function clinicalHistoryLayout() {
  const pl=[]; let page=0, y=advanceSectionTitle(headerStartY());
  for (const k of ['__patient_name','edad','sexo','ocupacion','__visit_date','profesional_responsable']) y=placeLineField(pl,k,page,y);
  y=advanceSectionTitle(y);
  for (const k of ['motivo_consulta','antecedentes_personales','historial_familiar','sintomatologia']) { y=placeAreaField(pl,k,page,y); if(y<PAGE_BREAK_THRESHOLD){page++;y=headerStartY();} }
  for (const k of ['peso','altura','tipo','frecuencia_ejercicio']) y=placeLineField(pl,k,page,y);
  for (const k of ['efectos_lesion','descripcion_sintomas','valoracion_movilidad','pruebas_diagnosticas','diagnostico','tratamiento_recomendado','evolucion']) { if(y<PAGE_BREAK_THRESHOLD){page++;y=headerStartY();} y=placeAreaField(pl,k,page,y); }
  return pl;
}
function interventionConsentLayout() {
  const pl=[]; let page=0, y=advanceSectionTitle(headerStartY());
  for (const k of ['__patient_name','__patient_document_id','fecha_consentimiento','nombre_firmante','dni_firmante','nombre_tutor','dni_tutor']) y=placeLineField(pl,k,page,y);
  y=advanceSectionTitle(y);
  y=placeLineField(pl,'tecnica_intervencion',page,y);
  for (const k of ['objetivo','riesgos_explicitados','alternativas_explicitadas','contraindicaciones']) { y=placeAreaField(pl,k,page,y); if(y<PAGE_BREAK_THRESHOLD){page++;y=headerStartY();} }
  placeLineField(pl,'firma_recogida',page,y);
  return pl;
}
function dataConsentLayout() {
  const pl=[]; let page=0, y=advanceSectionTitle(headerStartY());
  for (const k of ['__patient_name','__patient_document_id','fecha_consentimiento','nombre_firmante','dni_firmante','nombre_tutor','dni_tutor']) y=placeLineField(pl,k,page,y);
  y=advanceSectionTitle(y);
  y=placeLineField(pl,'responsable_tratamiento',page,y);
  y=placeAreaField(pl,'finalidad',page,y);
  y=placeLineField(pl,'base_legal',page,y);
  y=placeAreaField(pl,'cesiones_previstas',page,y);
  y=placeLineField(pl,'plazo_conservacion',page,y);
  placeLineField(pl,'canal_electronico_autorizado',page,y);
  return pl;
}

function wrapLines(text,font,fontSize,maxWidth,maxLines) {
  const norm=text.replace(/\s+/g,' ').trim();
  if(!norm) return {lines:[],truncated:false};
  const words=norm.split(' '); const lines=[]; let cur='',consumed=0;
  for(const w of words){ const cand=cur?`${cur} ${w}`:w; if(font.widthOfTextAtSize(cand,fontSize)<=maxWidth){cur=cand;consumed++;continue;} if(cur){lines.push(cur);if(lines.length>=maxLines)break;} cur=w;consumed++; }
  if(lines.length<maxLines&&cur) lines.push(cur);
  if(lines.length>maxLines) return {lines:lines.slice(0,maxLines),truncated:true};
  let truncated=false;
  if(lines.length===maxLines&&consumed<words.length){ let cut=lines[maxLines-1]??''; while(cut.length>1&&font.widthOfTextAtSize(`${cut}...`,fontSize)>maxWidth)cut=cut.slice(0,-1); lines[maxLines-1]=`${cut}...`; truncated=true; }
  return {lines,truncated};
}
function fitText(text,pl,font) {
  for(let fs=pl.fontSize;fs>=pl.minFontSize;fs-=0.5){ const {lines,truncated}=wrapLines(text,font,fs,pl.maxWidth,pl.maxLines); if(lines.length===0)return{text:'',fontSize:fs,lineHeight:pl.lineHeight}; if(!truncated)return{text:lines.join('\n'),fontSize:fs,lineHeight:pl.lineHeight*(fs/pl.fontSize)}; }
  const {lines}=wrapLines(text,font,pl.minFontSize,pl.maxWidth,pl.maxLines);
  return{text:lines.join('\n'),fontSize:pl.minFontSize,lineHeight:pl.lineHeight*(pl.minFontSize/pl.fontSize)};
}
function firstLineWidth(text,font,fs){ return font.widthOfTextAtSize(text.split('\n')[0]??'',fs); }
function toDateEs(v){ return /^\d{4}-\d{2}-\d{2}$/.test(v)?v.split('-').reverse().join('/'):v; }

async function render(templateFile, layout, fieldFn) {
  const bytes = await readFile(path.join(CWD,'public','consentimientos',templateFile));
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const pl of layout) {
    const page = doc.getPage(pl.page); if(!page) continue;
    const value = fieldFn(pl.key); if(!value) continue;
    const fitted = fitText(value,pl,font); if(!fitted.text) continue;
    if(pl.kind==='line') {
      const lineY = pl.y - LINE_TEXT_OFFSET_Y;
      const lw = Math.min(firstLineWidth(fitted.text,font,fitted.fontSize)+8, pl.maxWidth);
      page.drawRectangle({ x:MARGIN_X, y:lineY-1, width:(pl.x-MARGIN_X)+lw+2, height:2, color:rgb(1,1,1), borderWidth:0 });
    }
    page.drawText(fitted.text,{x:pl.x,y:pl.y,font,size:fitted.fontSize,lineHeight:fitted.lineHeight,maxWidth:pl.maxWidth,color:rgb(0,0,0)});
  }
  return doc.save();
}

const CLINICAL_DATA = {
  patientName:'Laura Martínez Gómez', patientDocumentId:'12345678A', visitDate:'2026-05-10',
  formData:{ edad:'45 años', sexo:'Femenino', ocupacion:'Ingeniera de telecomunicaciones y docente universitaria', profesional_responsable:'Aaron López Jefto',
    motivo_consulta:'Dolor lumbar mecánico recurrente con irradiación ocasional a glúteo derecho tras jornadas largas de trabajo, sedestación prolongada y entrenamiento irregular de fuerza.',
    antecedentes_personales:'Episodios previos de lumbalgia, esguince antiguo de tobillo izquierdo, gastritis por AINEs y cirugía dental reciente sin incidencias.',
    historial_familiar:'Padre con artrosis y madre con osteoporosis controlada.',
    sintomatologia:'Rigidez matutina, dolor al incorporarse, fatiga lumbar al final del día, sensación de bloqueo al flexionar y molestia al cargar peso desde el suelo.',
    peso:'64 kg', altura:'1,61 m', tipo:'Constitución mesomorfa', frecuencia_ejercicio:'Dos sesiones semanales irregulares: caminatas urbanas y baja movilidad durante la jornada laboral.',
    efectos_lesion:'Dificultad para permanecer sentada más de una hora, molestias al conducir trayectos largos y limitación al agacharse para tareas domésticas.',
    descripcion_sintomas:'Dolor sordo en zona lumbar baja (L4-L5), con episodios de agudización al cambiar de postura bruscamente o al finalizar sesiones de ejercicio.',
    valoracion_movilidad:'Flexión anterior limitada al 60%, extensión dolorosa, rotación bilateral compensada. Maniobra de Lasègue negativa bilateralmente.',
    pruebas_diagnosticas:'Radiografía lumbar: discreta disminución del espacio L4-L5. Ecografía muscular: hipertonía paravertebral bilateral sin desgarro.',
    diagnostico:'Síndrome de dolor lumbar crónico inespecífico con componente miofascial y probable disfunción del segmento L4-L5.',
    tratamiento_recomendado:'Terapia manual, ejercicio terapéutico de estabilización lumbar, educación postural y técnicas de liberación miofascial. 2 sesiones/semana durante 8 semanas.',
    evolucion:'Pendiente de reevaluación tras las primeras 4 sesiones.' }
};

const CONSENT_DATA = {
  patientName:'Laura Martínez Gómez', patientDocumentId:'12345678A', visitDate:'2026-05-10',
  formData:{ fecha_consentimiento:'2026-05-10', nombre_firmante:'Laura Martínez Gómez', dni_firmante:'12345678A', nombre_tutor:'', dni_tutor:'',
    tecnica_intervencion:'Punción seca profunda y técnica de liberación miofascial en zona lumbar y glúteo derecho.',
    objetivo:'Reducción del dolor miofascial, mejora de la movilidad lumbar y normalización del tono muscular en la cadena posterior.',
    riesgos_explicitados:'Hematoma local, dolor postpunción 24-48h, mareo transitorio, infección en caso de mala asepsia (improbable), síncope vasovagal.',
    alternativas_explicitadas:'Masaje terapéutico convencional, electroterapia (TENS), infiltración médica con corticoides, reposo relativo.',
    contraindicaciones:'Alergia a metales, anticoagulación activa, embarazo, trastorno de coagulación no controlado.',
    firma_recogida:'Sí' }
};

const LOPD_DATA = {
  patientName:'Laura Martínez Gómez', patientDocumentId:'12345678A',
  formData:{ fecha_consentimiento:'2026-05-10', nombre_firmante:'Laura Martínez Gómez', dni_firmante:'12345678A', nombre_tutor:'', dni_tutor:'',
    responsable_tratamiento:'Fisioterapia Zeus S.L.',
    finalidad:'Gestión del historial clínico, planificación del tratamiento fisioterapéutico, facturación y comunicación con el paciente.',
    base_legal:'Consentimiento explícito del interesado y cumplimiento de obligación legal sanitaria (Ley 41/2002).',
    cesiones_previstas:'No se cederán datos a terceros salvo obligación legal o derivación médica con consentimiento previo del paciente.',
    plazo_conservacion:'5 años desde el alta, o el plazo legalmente establecido por la normativa sanitaria aplicable.',
    canal_electronico_autorizado:'Sí' }
};

function makeFieldFn(input) {
  return (key) => {
    if(key==='__patient_name') return input.patientName??'';
    if(key==='__patient_document_id') return input.patientDocumentId??'';
    if(key==='__visit_date') return toDateEs(input.visitDate??'');
    const raw=String(input.formData[key]??'').trim();
    if(!raw) return '';
    if(key.startsWith('fecha_')) return toDateEs(raw);
    return raw;
  };
}

// Generate PDFs
const ch = await render('historia_clinica_fisioterapeutica_template.pdf', clinicalHistoryLayout(), makeFieldFn(CLINICAL_DATA));
const ic = await render('consentimiento_intervencion_template.pdf', interventionConsentLayout(), makeFieldFn(CONSENT_DATA));
const dc = await render('consentimiento_lopd_template.pdf', dataConsentLayout(), makeFieldFn(LOPD_DATA));

// Save PDFs temporarily
await writeFile('/tmp/ch.pdf', Buffer.from(ch));
await writeFile('/tmp/ic.pdf', Buffer.from(ic));
await writeFile('/tmp/dc.pdf', Buffer.from(dc));

console.log('PDFs generated. Sizes:', ch.length, ic.length, dc.length);

// Convert to PNG using sips (macOS)
function sipsToPng(src, dest) {
  execSync(`sips -s format png "${src}" --out "${dest}" 2>/dev/null`);
}

sipsToPng('/tmp/ch.pdf', '/tmp/ch.png');
sipsToPng('/tmp/ic.pdf', '/tmp/ic.png');
sipsToPng('/tmp/dc.pdf', '/tmp/dc.png');

// Copy to pdf-verification
execSync(`cp /tmp/ch.png "${OUT}/clinical_history-page-1.png"`);
execSync(`cp /tmp/ic.png "${OUT}/intervention_consent-page-1.png"`);
execSync(`cp /tmp/dc.png "${OUT}/data_consent-page-1.png"`);

console.log('Done. Files in pdf-verification:', execSync(`ls "${OUT}"`).toString().trim());
