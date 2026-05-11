import { renderPatientDocumentPdf } from './src/lib/patient-document-pdf';
import { writeFileSync } from 'node:fs';

const pdf = await renderPatientDocumentPdf({
  documentType: 'clinical_history',
  patientName: 'Ana Martínez',
  visitDate: '2026-05-10',
  formData: {
    edad: '35', sexo: 'Mujer', ocupacion: 'Fisioterapeuta',
    motivo_consulta: 'Dolor cervical con irradiación al hombro derecho',
    antecedentes_personales: 'Patología recurrente una vez al semestre',
    historial_familiar: 'Sin antecedentes relevantes',
    sintomatologia: 'Cefaleas, vértigos, mareos y dificultad de movilidad del cuello',
    peso: '62 kg', altura: '165 cm', tipo: 'Normal',
    frecuencia_ejercicio: '3 días en semana',
    efectos_lesion: 'Imposibilidad para entrenar y dificultad para trabajar',
    descripcion_sintomas: 'Dolor continuo en región cervical',
    valoracion_movilidad: 'Pérdida de rotación e inclinación',
    pruebas_diagnosticas: 'No',
    diagnostico: 'Cervicalgia aguda causada por la postura en el trabajo',
    tratamiento_recomendado: 'Terapia manual, estiramiento, punción seca y ejercicio',
    evolucion: 'A la espera de resultados'
  }
});

writeFileSync('/tmp/test_historia_clinica.pdf', Buffer.from(pdf));
console.log('Saved:', pdf.length, 'bytes');
