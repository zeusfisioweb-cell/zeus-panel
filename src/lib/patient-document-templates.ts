import type { PatientDocumentType } from '@/lib/types';

// Each slot is one inline blank in the original legal document, located by the
// PDF extractor (text baseline + size, in PDF points, origin bottom-left).
// `field` is the AcroForm field name; slots sharing a field render the same
// value (multi-widget AcroForm field).
export interface TemplateSlot {
    field: string;
    page: number;
    x0: number;
    x1: number;
    baseline: number;
    sampleSize: number;
}

// Where each field's value comes from at render time.
//  - 'config'  : derived server-side from booking_settings
//  - 'form'    : entered by the admin in the document modal
//  - 'date:*'  : derived from the document date
export type FieldSource =
    | { kind: 'config'; key: 'clinic_name' | 'address' | 'city' }
    | { kind: 'form'; key: string }
    | { kind: 'date'; part: 'day' | 'month' | 'year' }
    | { kind: 'patient'; key: 'name_first' | 'name_rest' | 'document_id' };

// A field anchor for the clinical-history form. The original document is a
// flowing label/value layout (not fixed inline blanks): sample data is removed
// by geometry and replaced with AcroForm fields keyed off the static text.
export interface HistoriaAnchor {
    // Normalized (lowercase, no spaces/accents) prefix of the static line.
    match: string;
    field: string;
    // 'inline' = value sits after the label colon on the same line.
    // 'block'  = value flows on the following indented lines (multiline field).
    kind: 'inline' | 'block';
}

// A handwritten-signature area. The original's blank guide + baked sample
// signature are covered with a white band and replaced by one clean printed
// line just below the "Firma" label (no AcroForm field — an editable field
// renders as a tinted box in Chrome and reads as broken).
export interface SignatureField {
    page: number;
    // PDF-point baseline of the "Firma" label this area belongs to.
    labelBaseline: number;
}

export interface TemplateSpec {
    sourcePdf: string;
    slots: TemplateSlot[];
    fieldSources: Record<string, FieldSource>;
    mode?: 'slots' | 'historia';
    historiaAnchors?: HistoriaAnchor[];
    signatureFields?: SignatureField[];
}

export function normalizeLine(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9:]/g, '');
}

// Exact extents of the original sample text (extracted from the source PDFs),
// so filled values land precisely where the blanks are in the legal prose.
const DATE_LINE = (page: number, baseline: number): TemplateSlot[] => [
    // x1 ends just before the next static word (" el ", " de ", " de ") so the
    // value does not overlap the surrounding prose.
    { field: 'lugar', page, x0: 86.1, x1: 128.9, baseline, sampleSize: 15.6 },
    { field: 'dia', page, x0: 139.5, x1: 158, baseline, sampleSize: 15.6 },
    { field: 'mes', page, x0: 171.7, x1: 227.3, baseline, sampleSize: 15.6 },
    { field: 'anio', page, x0: 242, x1: 300, baseline, sampleSize: 15.6 },
];

export const PATIENT_DOCUMENT_TEMPLATES: Partial<Record<PatientDocumentType, TemplateSpec>> = {
    data_consent: {
        sourcePdf: 'consentimiento_lopd_original.pdf',
        slots: [
            { field: 'clinic_name', page: 0, x0: 235.6, x1: 358.2, baseline: 652.2, sampleSize: 15.6 },
            { field: 'responsable_tratamiento', page: 0, x0: 149.8, x1: 251.8, baseline: 629.7, sampleSize: 15.6 },
            { field: 'clinic_name', page: 0, x0: 125.3, x1: 247.9, baseline: 554.7, sampleSize: 15.6 },
            { field: 'direccion', page: 0, x0: 72, x1: 260, baseline: 505.9, sampleSize: 15.6 },
            ...DATE_LINE(0, 280.9),
            { field: 'nombre_firmante', page: 0, x0: 106.4, x1: 204.1, baseline: 190.9, sampleSize: 15.6 },
            // dni_firmante ends the line, safe to widen.
            { field: 'dni_firmante', page: 0, x0: 243.5, x1: 340, baseline: 190.9, sampleSize: 15.6 },
            { field: 'nombre_tutor', page: 1, x0: 107, x1: 290, baseline: 607.9, sampleSize: 15.6 },
            // dni_tutor ends the line.
            { field: 'dni_tutor', page: 1, x0: 340, x1: 550, baseline: 607.9, sampleSize: 15.6 },
        ],
        fieldSources: {
            clinic_name: { kind: 'config', key: 'clinic_name' },
            responsable_tratamiento: { kind: 'config', key: 'clinic_name' },
            direccion: { kind: 'config', key: 'address' },
            lugar: { kind: 'config', key: 'city' },
            dia: { kind: 'date', part: 'day' },
            mes: { kind: 'date', part: 'month' },
            anio: { kind: 'date', part: 'year' },
            nombre_firmante: { kind: 'form', key: 'nombre_firmante' },
            dni_firmante: { kind: 'form', key: 'dni_firmante' },
            nombre_tutor: { kind: 'form', key: 'nombre_tutor' },
            dni_tutor: { kind: 'form', key: 'dni_tutor' },
        },
    },
    intervention_consent: {
        sourcePdf: 'consentimiento_intervencion_original.pdf',
        slots: [
            // Page idx4 ("Página 5 de 6"). Coordinates measured from the
            // surrounding static prose in the original PDF; baselines match the
            // body text (9.9pt) so filled values sit on the same line.
            // "En ___ el ___ de ___ de ___"
            { field: 'lugar', page: 4, x0: 86, x1: 127, baseline: 731.2, sampleSize: 15.6 },
            { field: 'dia', page: 4, x0: 139, x1: 155, baseline: 731.2, sampleSize: 15.6 },
            { field: 'mes', page: 4, x0: 172, x1: 225, baseline: 731.2, sampleSize: 15.6 },
            { field: 'anio', page: 4, x0: 242, x1: 300, baseline: 731.2, sampleSize: 15.6 },
            // PACIENTE: "D/Dña ___ con DNI ___"
            { field: 'nombre_firmante', page: 4, x0: 106, x1: 201, baseline: 641.9, sampleSize: 15.6 },
            // dni_firmante ends the line, safe to widen.
            { field: 'dni_firmante', page: 4, x0: 243, x1: 400, baseline: 641.9, sampleSize: 15.6 },
            // TUTOR line 1: "Ante la imposibilidad de D/Dña ___ con DNI ___ de prestar..."
            { field: 'nombre_tutor', page: 4, x0: 229, x1: 323, baseline: 194.2, sampleSize: 15.6 },
            { field: 'dni_tutor', page: 4, x0: 366, x1: 425, baseline: 194.2, sampleSize: 15.6 },
            // TUTOR line 2: "D/Dña ___ con DNI ___ . En calidad de ___"
            { field: 'nombre_tutor', page: 4, x0: 106, x1: 294, baseline: 143.9, sampleSize: 15.6 },
            { field: 'dni_tutor', page: 4, x0: 337, x1: 412, baseline: 143.9, sampleSize: 15.6 },
            // relacion_tutor ends the line, safe to widen.
            { field: 'relacion_tutor', page: 4, x0: 489, x1: 570, baseline: 143.9, sampleSize: 15.6 },
            // Page idx5 ("Página 6 de 6"). FISIOTERAPEUTA block.
            { field: 'nombre_fisioterapeuta', page: 5, x0: 106, x1: 206, baseline: 559.4, sampleSize: 15.6 },
            { field: 'num_colegiado', page: 5, x0: 248, x1: 311, baseline: 559.4, sampleSize: 15.6 },
            { field: 'clinic_name', page: 5, x0: 147, x1: 270, baseline: 536.9, sampleSize: 15.6 },
        ],
        signatureFields: [
            { page: 4, labelBaseline: 371.2 }, // PACIENTE
            { page: 5, labelBaseline: 736.4 }, // TUTOR
            { page: 5, labelBaseline: 428.2 }, // FISIOTERAPEUTA
        ],
        fieldSources: {
            lugar: { kind: 'config', key: 'city' },
            dia: { kind: 'date', part: 'day' },
            mes: { kind: 'date', part: 'month' },
            anio: { kind: 'date', part: 'year' },
            clinic_name: { kind: 'config', key: 'clinic_name' },
            nombre_firmante: { kind: 'form', key: 'nombre_firmante' },
            dni_firmante: { kind: 'form', key: 'dni_firmante' },
            nombre_tutor: { kind: 'form', key: 'nombre_tutor' },
            dni_tutor: { kind: 'form', key: 'dni_tutor' },
            relacion_tutor: { kind: 'form', key: 'relacion_tutor' },
            nombre_fisioterapeuta: { kind: 'form', key: 'nombre_fisioterapeuta' },
            num_colegiado: { kind: 'form', key: 'num_colegiado' },
        },
    },
    clinical_history: {
        sourcePdf: 'historia_clinica_fisioterapeutica_original.pdf',
        slots: [],
        mode: 'historia',
        historiaAnchors: [
            { match: 'nombre:', field: 'nombre', kind: 'inline' },
            { match: 'apellidos:', field: 'apellidos', kind: 'inline' },
            { match: 'edad:', field: 'edad', kind: 'inline' },
            { match: 'sexo:', field: 'sexo', kind: 'inline' },
            { match: 'ocupacion:', field: 'ocupacion', kind: 'inline' },
            { match: 'peso:', field: 'peso', kind: 'inline' },
            { match: 'altura:', field: 'altura', kind: 'inline' },
            { match: 'tipo:', field: 'tipo', kind: 'inline' },
            { match: 'frecuenciadeejerciciofisico:', field: 'frecuencia_ejercicio', kind: 'inline' },
            { match: 'motivodelaconsulta', field: 'motivo_consulta', kind: 'block' },
            { match: 'antecedentespersonales:', field: 'antecedentes_personales', kind: 'block' },
            { match: 'historialfamiliar:', field: 'historial_familiar', kind: 'block' },
            { match: 'sintomatologiapresentadaporelpaciente', field: 'sintomatologia', kind: 'block' },
            { match: 'efectosdelalesionsobrelacapacidad', field: 'efectos_lesion', kind: 'block' },
            { match: 'descripciondelossintomasdeladolencia', field: 'descripcion_sintomas', kind: 'block' },
            { match: 'valoraciondelamovilidad', field: 'valoracion_movilidad', kind: 'block' },
            { match: 'pruebasdiagnosticas', field: 'pruebas_diagnosticas', kind: 'block' },
            { match: 'diagnosticodelproblemapresentadoporelpaciente', field: 'diagnostico', kind: 'block' },
            { match: 'tratamientorecomendado', field: 'tratamiento_recomendado', kind: 'block' },
            { match: 'evoluciondelpacientetraseltratamiento', field: 'evolucion', kind: 'block' },
        ],
        fieldSources: {
            nombre: { kind: 'patient', key: 'name_first' },
            apellidos: { kind: 'patient', key: 'name_rest' },
            lugar: { kind: 'config', key: 'city' },
            dia: { kind: 'date', part: 'day' },
            mes: { kind: 'date', part: 'month' },
            anio: { kind: 'date', part: 'year' },
            edad: { kind: 'form', key: 'edad' },
            sexo: { kind: 'form', key: 'sexo' },
            ocupacion: { kind: 'form', key: 'ocupacion' },
            peso: { kind: 'form', key: 'peso' },
            altura: { kind: 'form', key: 'altura' },
            tipo: { kind: 'form', key: 'tipo' },
            frecuencia_ejercicio: { kind: 'form', key: 'frecuencia_ejercicio' },
            motivo_consulta: { kind: 'form', key: 'motivo_consulta' },
            antecedentes_personales: { kind: 'form', key: 'antecedentes_personales' },
            historial_familiar: { kind: 'form', key: 'historial_familiar' },
            sintomatologia: { kind: 'form', key: 'sintomatologia' },
            efectos_lesion: { kind: 'form', key: 'efectos_lesion' },
            descripcion_sintomas: { kind: 'form', key: 'descripcion_sintomas' },
            valoracion_movilidad: { kind: 'form', key: 'valoracion_movilidad' },
            pruebas_diagnosticas: { kind: 'form', key: 'pruebas_diagnosticas' },
            diagnostico: { kind: 'form', key: 'diagnostico' },
            tratamiento_recomendado: { kind: 'form', key: 'tratamiento_recomendado' },
            evolucion: { kind: 'form', key: 'evolucion' },
        },
    },
};

const MONTHS_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function dateParts(iso: string | null | undefined): { day: string; month: string; year: string } {
    const fallback = new Date();
    let d = fallback;
    if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, day] = iso.split('-').map(Number);
        d = new Date(y, m - 1, day);
    }
    return {
        day: String(d.getDate()),
        month: MONTHS_ES[d.getMonth()],
        year: String(d.getFullYear()),
    };
}

// Best-effort city + province extraction from a free-text postal address.
// "Calle Mayor 1, 45500 Torrijos, Toledo" -> "Torrijos, Toledo"
// "Calle Mayor 1, 45500 Torrijos"         -> "Torrijos"
export function cityFromAddress(address: string | null | undefined): string {
    if (!address) return '';
    const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return '';
    const postalIdx = parts.findIndex((p) => /\d{4,5}/.test(p));
    if (postalIdx === -1) return parts[parts.length - 1];
    const city = parts[postalIdx].replace(/\d{4,5}/, '').trim();
    return [city, ...parts.slice(postalIdx + 1)].filter(Boolean).join(', ');
}

// AcroForm rectangle + value font size derived from the original slot so the
// filled value sits on the same baseline as the surrounding legal text.
export function slotRect(slot: TemplateSlot): {
    rect: [number, number, number, number];
    fontSize: number;
} {
    const fontSize = Math.min(11, Math.max(8, slot.sampleSize * 0.62));
    // Widget rect chosen so the rendered value lands ON the prose baseline.
    // pdf-lib / Chrome draw the value with its baseline near the bottom of the
    // widget rect (descender hangs ~0.2*fontSize below). So y0 sits ~0.2*fs
    // BELOW the prose baseline to align the text baselines.
    const y0 = slot.baseline - fontSize * 0.2;
    const y1 = slot.baseline + fontSize * 1.1;
    return { rect: [slot.x0, y0, slot.x1, y1], fontSize };
}
