import { describe, it, expect } from 'vitest';
import {
    AnamnesisContentSchema,
    ExplorationContentSchema,
    EvolutionContentSchema,
    ReportContentSchema,
    validateClinicalContent,
} from './clinical-content-schemas';

describe('AnamnesisContentSchema', () => {
    it('accepts valid anamnesis', () => {
        expect(AnamnesisContentSchema.safeParse({ chief_complaint: 'Lower back pain' }).success).toBe(true);
    });

    it('rejects missing chief_complaint', () => {
        expect(AnamnesisContentSchema.safeParse({ medical_history: 'none' }).success).toBe(false);
    });

    it('rejects chief_complaint shorter than 3 chars', () => {
        expect(AnamnesisContentSchema.safeParse({ chief_complaint: 'ab' }).success).toBe(false);
    });

    it('accepts all optional fields populated', () => {
        expect(AnamnesisContentSchema.safeParse({
            chief_complaint: 'Pain',
            medical_history: 'Diabetes',
            medications: 'Metformin',
            observations: 'Sedentary lifestyle',
        }).success).toBe(true);
    });
});

describe('ExplorationContentSchema', () => {
    it('accepts empty object (all fields optional)', () => {
        expect(ExplorationContentSchema.safeParse({}).success).toBe(true);
    });

    it('accepts visual_inspection only', () => {
        expect(ExplorationContentSchema.safeParse({ visual_inspection: 'Postura antálgica' }).success).toBe(true);
    });

    it('accepts palpation only', () => {
        expect(ExplorationContentSchema.safeParse({ palpation: 'Contractura L4-L5' }).success).toBe(true);
    });

    it('accepts mobility only', () => {
        expect(ExplorationContentSchema.safeParse({ mobility: 'Flexión limitada 50%' }).success).toBe(true);
    });

    it('accepts all fields populated', () => {
        expect(ExplorationContentSchema.safeParse({
            visual_inspection: 'Postura antálgica',
            palpation: 'Contractura L4-L5',
            mobility: 'Flexión limitada 50%',
            specific_tests: 'Lasègue negativo',
        }).success).toBe(true);
    });
});

describe('EvolutionContentSchema', () => {
    const valid = { treatment_applied: 'Massage therapy' };

    it('accepts valid evolution', () => {
        expect(EvolutionContentSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects missing treatment_applied', () => {
        expect(EvolutionContentSchema.safeParse({ patient_response: 'Good' }).success).toBe(false);
    });

    it('rejects treatment_applied shorter than 3 chars', () => {
        expect(EvolutionContentSchema.safeParse({ treatment_applied: 'ab' }).success).toBe(false);
    });

    it('accepts patient_response field', () => {
        expect(EvolutionContentSchema.safeParse({ ...valid, patient_response: 'Mejoría subjetiva' }).success).toBe(true);
    });

    it('accepts next_session_plan field', () => {
        expect(EvolutionContentSchema.safeParse({ ...valid, next_session_plan: 'Continuar 2x semana' }).success).toBe(true);
    });
});

describe('ReportContentSchema', () => {
    it('accepts diagnosis only', () => {
        expect(ReportContentSchema.safeParse({ diagnosis: 'Lumbar sprain' }).success).toBe(true);
    });

    it('rejects missing diagnosis', () => {
        expect(ReportContentSchema.safeParse({ treatment_applied: 'Rest' }).success).toBe(false);
    });

    it('rejects diagnosis shorter than 3 chars', () => {
        expect(ReportContentSchema.safeParse({ diagnosis: 'ab' }).success).toBe(false);
    });

    it('accepts all optional fields populated', () => {
        expect(ReportContentSchema.safeParse({
            diagnosis: 'Lumbociatalgia',
            treatment_applied: '8 sesiones realizadas',
            results: 'Mejoría 80% EVA',
            recommendations: 'Ejercicios domiciliarios',
        }).success).toBe(true);
    });
});

describe('validateClinicalContent', () => {
    it('validates correct anamnesis', () => {
        expect(validateClinicalContent('anamnesis', { chief_complaint: 'Shoulder pain' }).success).toBe(true);
    });

    it('rejects evolution with only anamnesis fields', () => {
        // missing treatment_applied → invalid for evolution
        expect(validateClinicalContent('evolution', { chief_complaint: 'Pain' }).success).toBe(false);
    });

    it('rejects evolution missing required fields', () => {
        expect(validateClinicalContent('evolution', { patient_response: 'Good' }).success).toBe(false);
    });

    it('validates correct evolution', () => {
        expect(validateClinicalContent('evolution', { treatment_applied: 'Terapia manual' }).success).toBe(true);
    });

    it('validates correct report', () => {
        expect(validateClinicalContent('report', { diagnosis: 'Cervical contracture' }).success).toBe(true);
    });

    it('validates empty exploration (all fields optional)', () => {
        expect(validateClinicalContent('exploration', {}).success).toBe(true);
    });
});
