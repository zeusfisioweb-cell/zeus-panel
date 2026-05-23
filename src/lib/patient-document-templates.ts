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
//  - 'config'  : derived from booking_settings (only `city` survives — used to
//                fill "En {ciudad} el ...". Other config fields are baked into
//                the plantilla.
//  - 'form'    : entered by the admin in the document modal
//  - 'date:*'  : derived from the document date
export type FieldSource =
    | { kind: 'config'; key: 'city' }
    | { kind: 'form'; key: string }
    | { kind: 'date'; part: 'day' | 'month' | 'year' };

// A field anchor for the clinical-history form. Kept for type compatibility
// with the dynamic builder, although `clinical_history` no longer uses
// AcroForm templates (renderHistoriaClinicaDynamic builds the PDF entirely).
export interface HistoriaAnchor {
    match: string;
    field: string;
    kind: 'inline' | 'block';
}

// Caja de firma (rectángulo punteado) en el PDF original donde se embebe la
// imagen PNG capturada por el SignaturePad. `source` mapea a la clave del
// formData (`signature_firmante` o `signature_tutor`). Coords en puntos PDF
// (origen abajo-izquierda).
export interface SignatureBox {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    source: 'firmante' | 'tutor';
}

export interface TemplateSpec {
    sourcePdf: string;
    slots: TemplateSlot[];
    fieldSources: Record<string, FieldSource>;
    // Y baselines (in points) where the legal prose carries a fillable line
    // and the sample/data font renders the placeholder. The build script uses
    // these to remove sample-font show-text ops on those rows while keeping
    // baked-in clinic data (clinic name, address, responsible therapist, etc.)
    // intact on other rows.
    slotBaselines?: { page: number; y: number }[];
    signatureBoxes?: SignatureBox[];
}

export function normalizeLine(s: string): string {
    return s
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
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
            ...DATE_LINE(0, 280.9),
            { field: 'nombre_firmante', page: 0, x0: 106.4, x1: 204.1, baseline: 190.9, sampleSize: 15.6 },
            { field: 'dni_firmante', page: 0, x0: 243.5, x1: 340, baseline: 190.9, sampleSize: 15.6 },
            { field: 'nombre_tutor', page: 1, x0: 107, x1: 290, baseline: 607.9, sampleSize: 9.9 },
            { field: 'dni_tutor', page: 1, x0: 340, x1: 550, baseline: 607.9, sampleSize: 9.9 },
        ],
        slotBaselines: [
            { page: 0, y: 280.9 },
            { page: 0, y: 190.9 },
            { page: 1, y: 607.9 },
        ],
        signatureBoxes: [
            // Caja paciente: pg2 TOP (continuación visual desde "Firma" label
            // en pg1). El layout original empuja el box a la siguiente página.
            { page: 1, x: 76, y: 675, width: 244, height: 110, source: 'firmante' },
            // Caja tutor: pg2 inferior, bajo "Firma" label tutor (y=568.2).
            { page: 1, x: 76, y: 440, width: 244, height: 110, source: 'tutor' },
        ],
        fieldSources: {
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
            ...DATE_LINE(4, 734.7),
            // PACIENTE: "D/Dña ___ con DNI ___"
            { field: 'nombre_firmante', page: 4, x0: 106, x1: 201, baseline: 645.4, sampleSize: 15.6 },
            { field: 'dni_firmante', page: 4, x0: 243, x1: 400, baseline: 645.4, sampleSize: 15.6 },
            // TUTOR line 1: "Ante la imposibilidad de D/Dña ___ con DNI ___ de prestar..."
            { field: 'nombre_tutor', page: 4, x0: 229, x1: 323, baseline: 197.7, sampleSize: 15.6 },
            { field: 'dni_tutor', page: 4, x0: 366, x1: 425, baseline: 197.7, sampleSize: 15.6 },
            // TUTOR line 2: "D/Dña ___ con DNI ___ . En calidad de ___"
            { field: 'nombre_tutor', page: 4, x0: 106, x1: 294, baseline: 147.4, sampleSize: 9.9 },
            { field: 'dni_tutor', page: 4, x0: 337, x1: 412, baseline: 147.4, sampleSize: 9.9 },
            { field: 'relacion_tutor', page: 4, x0: 489, x1: 570, baseline: 147.4, sampleSize: 9.9 },
        ],
        slotBaselines: [
            { page: 4, y: 734.7 },
            { page: 4, y: 645.4 },
            { page: 4, y: 197.7 },
            { page: 4, y: 147.4 },
        ],
        signatureBoxes: [
            { page: 4, x: 76, y: 250, width: 244, height: 100, source: 'firmante' },
            { page: 5, x: 76, y: 620, width: 244, height: 100, source: 'tutor' },
        ],
        fieldSources: {
            lugar: { kind: 'config', key: 'city' },
            dia: { kind: 'date', part: 'day' },
            mes: { kind: 'date', part: 'month' },
            anio: { kind: 'date', part: 'year' },
            nombre_firmante: { kind: 'form', key: 'nombre_firmante' },
            dni_firmante: { kind: 'form', key: 'dni_firmante' },
            nombre_tutor: { kind: 'form', key: 'nombre_tutor' },
            dni_tutor: { kind: 'form', key: 'dni_tutor' },
            relacion_tutor: { kind: 'form', key: 'relacion_tutor' },
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
