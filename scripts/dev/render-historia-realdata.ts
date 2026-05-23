/**
 * Calibración Historia Clínica: renderiza con datos representativos
 * (nombres reales, párrafos completos en bloques) para validar
 * alineación inline + flujo multi-línea de bloques.
 *
 *   node_modules/.bin/tsx scripts/dev/render-historia-realdata.ts
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderPatientDocumentPdf } from '../../src/lib/patient-document-pdf';

const OUT_DIR = '/tmp/zeus-pdf-test';

const LOREM_SHORT =
    'Dolor lumbar irradiado a miembro inferior derecho desde hace 3 semanas, agravado al sentarse.';
const LOREM_LONG =
    'Paciente refiere antecedente de hernia discal L4-L5 diagnosticada hace 5 años, ' +
    'tratada con fisioterapia conservadora. No cirugías previas. Sin alergias medicamentosas conocidas. ' +
    'HTA controlada con enalapril 10mg/día. Diabetes mellitus tipo 2 en tratamiento con metformina. ' +
    'Fumador 1 paquete/día desde los 18 años. Bebedor ocasional fines de semana.';

async function main(): Promise<void> {
    await mkdir(OUT_DIR, { recursive: true });
    const bytes = await renderPatientDocumentPdf({
        documentType: 'clinical_history',
        patientName: 'María José García-Hernández',
        patientDocumentId: '12345678A',
        clinicName: 'Zeus Fisioweb Torrijos',
        clinicAddress: 'Calle Mayor 12, 45500 Torrijos, Toledo',
        visitDate: '2026-05-22',
        formData: {
            edad: '47',
            sexo: 'Femenino',
            ocupacion: 'Administrativa',
            peso: '68 kg',
            altura: '1,65 m',
            tipo: 'Sedentario con ejercicio ocasional',
            frecuencia_ejercicio: '1-2 veces por semana',
            motivo_consulta: LOREM_SHORT,
            antecedentes_personales: LOREM_LONG,
            historial_familiar:
                'Madre con artritis reumatoide. Padre fallecido por infarto a los 62 años. Hermana con fibromialgia.',
            sintomatologia:
                'Dolor punzante con irradiación ciática hasta el pie. EVA 7/10 en reposo, 9/10 al caminar. ' +
                'Parestesias en cara lateral de pierna y dorso del pie. Sensación de adormecimiento ocasional.',
            efectos_lesion:
                'Imposibilidad de mantener postura sentada >20 minutos. Limitación marcada para conducir y desempeño laboral. ' +
                'Alteración del sueño por dolor nocturno.',
            descripcion_sintomas:
                'Sensación de pinchazo eléctrico al flexionar tronco; mejora parcial con calor local y AINEs.',
            valoracion_movilidad:
                'Flexión lumbar limitada al 50%, extensión 75%, rotación derecha 60%, izquierda 80%. ' +
                'Lasègue positivo a 40° derecho. Reflejo aquíleo disminuido derecho.',
            pruebas_diagnosticas:
                'RM lumbar (2026-04-12): hernia discal posterolateral derecha L4-L5 con compromiso radicular. ' +
                'EMG: signos de radiculopatía L5 derecha de intensidad moderada.',
            diagnostico:
                'Lumbociatalgia derecha por hernia discal L4-L5 con radiculopatía L5 de intensidad moderada.',
            tratamiento_recomendado:
                'Programa fisioterápico 3 sesiones/semana durante 4 semanas: electroterapia analgésica, ' +
                'masoterapia, ejercicios de estabilización lumbar (McKenzie), reeducación postural global. ' +
                'Revisión a las 4 semanas.',
            evolucion:
                'Sesión 1-3: dolor EVA 7→5, mejora movilidad flexión 50%→65%. ' +
                'Sesión 4-6: incorporación ejercicios activos, EVA 5→3. ' +
                'Sesión 7-9: refuerzo CORE, paciente refiere mejoría funcional significativa. ' +
                'Alta clínica a las 12 sesiones con EVA 1/10, recomendación mantenimiento domiciliario.',
        },
    });
    const outPath = path.join(OUT_DIR, 'clinical_history_realdata.pdf');
    await writeFile(outPath, bytes);
    process.stdout.write(`[ok] ${outPath}\n`);
}

main().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
});
