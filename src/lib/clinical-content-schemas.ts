import { z } from 'zod';
import type { RecordType } from '@/lib/types';

// ─── Per-type content schemas ─────────────────────────────────────────────────

export const AnamnesisContentSchema = z.object({
    chief_complaint: z.string().min(3, { message: 'Motivo de consulta requerido' }),
    medical_history: z.string().optional(),
    medications: z.string().optional(),
    observations: z.string().optional(),
});

export const ExplorationContentSchema = z.object({
    visual_inspection: z.string().optional(),
    palpation: z.string().optional(),
    mobility: z.string().optional(),
    specific_tests: z.string().optional(),
});

export const EvolutionContentSchema = z.object({
    treatment_applied: z.string().min(3, { message: 'Sesión realizada requerida' }),
    patient_response: z.string().optional(),
    next_session_plan: z.string().optional(),
});

export const ReportContentSchema = z.object({
    diagnosis: z.string().min(3, { message: 'Diagnóstico requerido' }),
    treatment_applied: z.string().optional(),
    results: z.string().optional(),
    recommendations: z.string().optional(),
});

// ─── Inferred content types ───────────────────────────────────────────────────

export type AnamnesisContent = z.infer<typeof AnamnesisContentSchema>;
export type ExplorationContent = z.infer<typeof ExplorationContentSchema>;
export type EvolutionContent = z.infer<typeof EvolutionContentSchema>;
export type ReportContent = z.infer<typeof ReportContentSchema>;

export type ClinicalRecordContent =
    | AnamnesisContent
    | ExplorationContent
    | EvolutionContent
    | ReportContent;

// ─── Registry ─────────────────────────────────────────────────────────────────

const contentSchemas = {
    anamnesis: AnamnesisContentSchema,
    exploration: ExplorationContentSchema,
    evolution: EvolutionContentSchema,
    report: ReportContentSchema,
} satisfies Record<RecordType, z.ZodTypeAny>;

/**
 * Validates `content` against the schema for the given record type.
 */
export function validateClinicalContent(
    type: RecordType,
    content: unknown
): z.SafeParseReturnType<ClinicalRecordContent, ClinicalRecordContent> {
    return contentSchemas[type].safeParse(content) as z.SafeParseReturnType<ClinicalRecordContent, ClinicalRecordContent>;
}
