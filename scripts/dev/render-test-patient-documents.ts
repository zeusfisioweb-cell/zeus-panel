/**
 * Dev tool: renders the 3 patient document PDFs with visible marker values so
 * we can verify each slot lands on the correct line of the legal prose.
 *
 *   node_modules/.bin/tsx scripts/dev/render-test-patient-documents.ts
 *
 * Output: /tmp/zeus-pdf-test/{documentType}_filled.pdf
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderPatientDocumentPdf } from '../../src/lib/patient-document-pdf';
import { PATIENT_DOCUMENT_DEFINITIONS } from '../../src/lib/patient-document-definitions';
import type { PatientDocumentType } from '../../src/lib/types';

const OUT_DIR = '/tmp/zeus-pdf-test';

interface DocCase {
    type: PatientDocumentType;
    patientName: string;
    patientDocumentId: string;
    clinicName: string;
    clinicAddress: string;
    visitDate: string;
    formData: Record<string, string>;
}

const CASES: DocCase[] = [
    {
        type: 'data_consent',
        patientName: '«NOMBRE_PACIENTE» «APELLIDOS_PACIENTE»',
        patientDocumentId: '«DNI_PACIENTE»',
        clinicName: '«CLINIC_NAME»',
        clinicAddress: 'Calle X 1, 45500 «CIUDAD», Toledo',
        visitDate: '2025-03-15',
        formData: {
            nombre_firmante: '«nombre_firmante»',
            dni_firmante: '«dni_firmante»',
            nombre_tutor: '«nombre_tutor»',
            dni_tutor: '«dni_tutor»',
        },
    },
    {
        type: 'intervention_consent',
        patientName: '«NOMBRE_PACIENTE» «APELLIDOS_PACIENTE»',
        patientDocumentId: '«DNI_PACIENTE»',
        clinicName: '«CLINIC_NAME»',
        clinicAddress: 'Calle X 1, 45500 «CIUDAD», Toledo',
        visitDate: '2025-03-15',
        formData: {
            nombre_firmante: '«nombre_firmante»',
            dni_firmante: '«dni_firmante»',
            nombre_tutor: '«nombre_tutor»',
            dni_tutor: '«dni_tutor»',
            relacion_tutor: '«relacion_tutor»',
            nombre_fisioterapeuta: '«nombre_fisioterapeuta»',
            num_colegiado: '«num_colegiado»',
        },
    },
    {
        type: 'clinical_history',
        patientName: '«NOMBRE_PACIENTE» «APELLIDOS_PACIENTE»',
        patientDocumentId: '«DNI_PACIENTE»',
        clinicName: '«CLINIC_NAME»',
        clinicAddress: 'Calle X 1, 45500 «CIUDAD», Toledo',
        visitDate: '2025-03-15',
        formData: {
            edad: '«edad»',
            sexo: '«sexo»',
            ocupacion: '«ocupacion»',
            peso: '«peso»',
            altura: '«altura»',
            tipo: '«tipo»',
            frecuencia_ejercicio: '«frecuencia_ejercicio»',
            motivo_consulta: '«motivo_consulta»',
            antecedentes_personales: '«antecedentes_personales»',
            historial_familiar: '«historial_familiar»',
            sintomatologia: '«sintomatologia»',
            efectos_lesion: '«efectos_lesion»',
            descripcion_sintomas: '«descripcion_sintomas»',
            valoracion_movilidad: '«valoracion_movilidad»',
            pruebas_diagnosticas: '«pruebas_diagnosticas»',
            diagnostico: '«diagnostico»',
            tratamiento_recomendado: '«tratamiento_recomendado»',
            evolucion: '«evolucion»',
        },
    },
];

async function main(): Promise<void> {
    await mkdir(OUT_DIR, { recursive: true });
    const written: string[] = [];

    for (const c of CASES) {
        const bytes = await renderPatientDocumentPdf({
            documentType: c.type,
            patientName: c.patientName,
            patientDocumentId: c.patientDocumentId,
            visitDate: c.visitDate,
            clinicName: c.clinicName,
            clinicAddress: c.clinicAddress,
            formData: c.formData,
        });
        const outPath = path.join(OUT_DIR, `${c.type}_filled.pdf`);
        await writeFile(outPath, bytes);
        written.push(outPath);
        const title = PATIENT_DOCUMENT_DEFINITIONS[c.type].title;
        process.stdout.write(`[ok] ${title}\n      ${outPath}\n`);
    }

    process.stdout.write(`\nDone. ${written.length} files in ${OUT_DIR}\n`);
}

main().catch((err: unknown) => {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    process.stderr.write(`[error] ${msg}\n`);
    process.exit(1);
});
