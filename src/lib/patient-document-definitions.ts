import type { PatientDocumentType } from '@/lib/types';

export type PatientDocumentFieldType = 'text' | 'textarea' | 'date' | 'checkbox' | 'professional_select';

export interface PatientDocumentField {
    key: string;
    label: string;
    type: PatientDocumentFieldType;
    placeholder?: string;
}

export interface PatientDocumentSection {
    title: string;
    fields: PatientDocumentField[];
}

export interface PatientDocumentDefinition {
    title: string;
    templateFileName: string;
    sections: PatientDocumentSection[];
}

export const PATIENT_DOCUMENT_DEFINITIONS: Record<PatientDocumentType, PatientDocumentDefinition> = {
    clinical_history: {
        title: 'Historia clínica fisioterapéutica',
        templateFileName: 'historia_clinica_fisioterapeutica_template.pdf',
        sections: [
            {
                title: 'Datos del paciente',
                fields: [
                    { key: 'edad', label: 'Edad', type: 'text' },
                    { key: 'sexo', label: 'Sexo', type: 'text' },
                    { key: 'ocupacion', label: 'Ocupación', type: 'text' },
                    { key: 'fecha_primera_visita', label: 'Fecha primera visita', type: 'date' },
                    { key: 'profesional_responsable', label: 'Profesional responsable', type: 'professional_select' },
                ],
            },
            {
                title: 'Valoración clínica',
                fields: [
                    { key: 'motivo_consulta', label: 'Motivo de la consulta', type: 'textarea' },
                    { key: 'antecedentes_personales', label: 'Antecedentes personales', type: 'textarea' },
                    { key: 'historial_familiar', label: 'Historial familiar', type: 'textarea' },
                    { key: 'sintomatologia', label: 'Sintomatología presentada', type: 'textarea' },
                    { key: 'peso', label: 'Peso', type: 'text' },
                    { key: 'altura', label: 'Altura', type: 'text' },
                    { key: 'tipo', label: 'Tipo', type: 'text' },
                    { key: 'frecuencia_ejercicio', label: 'Frecuencia de ejercicio físico', type: 'text' },
                    { key: 'efectos_lesion', label: 'Efectos de la lesión en actividad diaria', type: 'textarea' },
                    { key: 'descripcion_sintomas', label: 'Descripción de síntomas', type: 'textarea' },
                    { key: 'valoracion_movilidad', label: 'Valoración de la movilidad', type: 'textarea' },
                    { key: 'pruebas_diagnosticas', label: 'Pruebas diagnósticas', type: 'textarea' },
                ],
            },
            {
                title: 'Diagnóstico y tratamiento',
                fields: [
                    { key: 'diagnostico', label: 'Diagnóstico', type: 'textarea' },
                    { key: 'tratamiento_recomendado', label: 'Tratamiento recomendado', type: 'textarea' },
                    { key: 'evolucion', label: 'Evolución del paciente', type: 'textarea' },
                ],
            },
        ],
    },
    intervention_consent: {
        title: 'Consentimiento de intervención',
        templateFileName: 'consentimiento_intervencion_template.pdf',
        sections: [
            {
                title: 'Datos de consentimiento',
                fields: [
                    { key: 'fecha_consentimiento', label: 'Fecha consentimiento', type: 'date' },
                    { key: 'nombre_firmante', label: 'Nombre del firmante', type: 'text' },
                    { key: 'dni_firmante', label: 'DNI/NIE del firmante', type: 'text' },
                    { key: 'nombre_tutor', label: 'Nombre tutor/familiar (si aplica)', type: 'text' },
                    { key: 'dni_tutor', label: 'DNI/NIE tutor/familiar (si aplica)', type: 'text' },
                ],
            },
            {
                title: 'Intervención y riesgos',
                fields: [
                    { key: 'tecnica_intervencion', label: 'Técnica / intervención', type: 'text' },
                    { key: 'objetivo', label: 'Objetivo terapéutico', type: 'textarea' },
                    { key: 'riesgos_explicitados', label: 'Riesgos explicados', type: 'textarea' },
                    { key: 'alternativas_explicitadas', label: 'Alternativas explicadas', type: 'textarea' },
                    { key: 'contraindicaciones', label: 'Contraindicaciones revisadas', type: 'textarea' },
                    { key: 'firma_recogida', label: 'Firma recogida físicamente', type: 'checkbox' },
                ],
            },
        ],
    },
    data_consent: {
        title: 'Consentimiento LOPD/RGPD',
        templateFileName: 'consentimiento_lopd_template.pdf',
        sections: [
            {
                title: 'Datos de tratamiento',
                fields: [
                    { key: 'fecha_consentimiento', label: 'Fecha consentimiento', type: 'date' },
                    { key: 'responsable_tratamiento', label: 'Responsable del tratamiento', type: 'text' },
                    { key: 'finalidad', label: 'Finalidad del tratamiento', type: 'textarea' },
                    { key: 'base_legal', label: 'Base legal', type: 'text' },
                    { key: 'cesiones_previstas', label: 'Cesiones previstas', type: 'textarea' },
                    { key: 'plazo_conservacion', label: 'Plazo de conservación', type: 'text' },
                    { key: 'canal_electronico_autorizado', label: 'Autoriza comunicaciones electrónicas', type: 'checkbox' },
                    { key: 'nombre_firmante', label: 'Nombre del firmante', type: 'text' },
                    { key: 'dni_firmante', label: 'DNI/NIE del firmante', type: 'text' },
                    { key: 'nombre_tutor', label: 'Nombre tutor/familiar (si aplica)', type: 'text' },
                    { key: 'dni_tutor', label: 'DNI/NIE tutor/familiar (si aplica)', type: 'text' },
                ],
            },
        ],
    },
};

export function getDocumentFields(documentType: PatientDocumentType): PatientDocumentField[] {
    return PATIENT_DOCUMENT_DEFINITIONS[documentType].sections.flatMap((section) => section.fields);
}
