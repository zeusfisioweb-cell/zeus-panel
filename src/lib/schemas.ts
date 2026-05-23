import { z } from 'zod';

// --- Shared Reusable Definitions ---
const phoneRegex = /^(?:\+34|0034|34)?[ -]*(?:6|7)[ -]*([0-9][ -]*){8}$/i; // Basic Spanish phone validation
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/; // HH:MM or HH:MM:SS

// ─── Patient ───────────────────────────────────────────────

const PatientBase = z.object({
    first_name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }).max(50),
    last_name: z.string().min(2, { message: 'Los apellidos deben tener al menos 2 caracteres' }).max(100),
    email: z.string().email({ message: 'Debe ser un correo electrónico válido' }).optional().or(z.literal('')),
    phone: z.string().regex(phoneRegex, { message: 'Formato de teléfono inválido' }).optional().or(z.literal('')),
    birth_date: z.string().optional().or(z.literal('')),
    document_id: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    gdpr_consent: z.boolean().optional(),
    marketing_consent: z.boolean().optional(),
});

export const PatientSchema = PatientBase.refine(data => data.email || data.phone, {
    message: "Debe proporcionar al menos un correo o número de teléfono",
    path: ["email"],
});

export const PatientUpdateSchema = PatientBase.partial();

// ─── Service Category ──────────────────────────────────────

export const ServiceCategorySchema = z.object({
    name: z.string().min(2, { message: 'El nombre de la categoría es requerido' }),
    description: z.string().optional(),
    color: z.string().optional(),
});

// ─── Service ───────────────────────────────────────────────

export const ServiceSchema = z.object({
    category_id: z.string().uuid({ message: 'Debe seleccionar una categoría válida' }),
    name: z.string().min(2, { message: 'El nombre del servicio es requerido' }),
    description: z.string().optional(),
    duration_minutes: z.coerce.number().int().min(5, { message: 'La duración mínima es de 5 minutos' }),
    price: z.coerce.number().min(0, { message: 'El precio no puede ser negativo' }),
    is_active: z.boolean().default(true),
});

export const ServiceUpdateSchema = ServiceSchema.partial();

// ─── Professional ──────────────────────────────────────────

export const ProfessionalProfileSchema = z.object({
    full_name: z.string().min(3, { message: 'El nombre completo es requerido' }),
    email: z.string().email({ message: 'Correo electrónico inválido' }),
    specialty: z.string().optional(),
    bio: z.string().optional(),
    color_code: z.string().regex(/^#[0-9A-Fa-f]{3,8}$/, { message: 'Color inválido (ej: #3B82F6)' }).optional(),
    is_active: z.boolean().default(true),
    selectedServices: z.array(z.string()).min(1, { message: 'Debe seleccionar al menos un servicio' }),
});

// Hook-level schema (matches CreateProfessionalPayload)
export const ProfessionalCreateSchema = z.object({
    email: z.string().email({ message: 'Correo electrónico inválido' }),
    full_name: z.string().min(3, { message: 'El nombre completo es requerido' }),
    specialty: z.string().optional().nullable(),
    bio: z.string().optional().nullable(),
    color_code: z.string().regex(/^#[0-9A-Fa-f]{3,8}$/, { message: 'Color inválido (ej: #3B82F6)' }).optional().nullable(),
    is_active: z.boolean().default(true).optional(),
    service_ids: z.array(z.string().min(1)).min(1, { message: 'Debe seleccionar al menos un servicio' }),
    schedule_slots: z.array(z.object({
        day_of_week: z.number().int().min(1).max(7),
        start_time: z.string().regex(timeRegex, { message: 'Formato de hora inválido' }),
        end_time: z.string().regex(timeRegex, { message: 'Formato de hora inválido' }),
    })).optional()
});

// ─── Appointment ───────────────────────────────────────────

// Form-level schema (separate date + time for UI validation)
export const AppointmentFormSchema = z.object({
    patient_id: z.string().min(1, { message: 'Debe seleccionar un paciente' }),
    professional_id: z.string().min(1, { message: 'Debe seleccionar un profesional' }),
    service_id: z.string().min(1, { message: 'Debe seleccionar un servicio' }),
    date: z.string().min(1, { message: 'Debe seleccionar una fecha' }),
    start_time: z.string().regex(timeRegex, { message: 'Formato de hora inválido' }),
    end_time: z.string().regex(timeRegex, { message: 'Formato de hora inválido' }),
    notes: z.string().optional(),
    source: z.enum(['web', 'admin', 'phone']).default('admin'),
}).refine(data => {
    const start = new Date(`${data.date}T${data.start_time}`);
    const end = new Date(`${data.date}T${data.end_time}`);
    return end > start;
}, {
    message: "La hora de fin debe ser posterior a la hora de inicio",
    path: ["end_time"],
});

// DB-level schema (timestamps as ISO strings, used in hooks)
export const AppointmentInsertSchema = z.object({
    patient_id: z.string().uuid({ message: 'ID de paciente inválido' }).nullable().optional(),
    professional_id: z.string().uuid({ message: 'ID de profesional inválido' }).nullable().optional(),
    service_id: z.string().uuid({ message: 'ID de servicio inválido' }),
    start_time: z.string().datetime({ message: 'Formato de fecha/hora inválido (ISO 8601)' }),
    end_time: z.string().datetime({ message: 'Formato de fecha/hora inválido (ISO 8601)' }),
    notes: z.string().nullable().optional(),
    patient_name: z.string().nullable().optional(),
    patient_phone: z.string().nullable().optional(),
    patient_email: z.string().nullable().optional(),
    source: z.enum(['web', 'admin', 'phone']).default('admin'),
    status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).default('confirmed'),
});

export const AppointmentUpdateSchema = AppointmentInsertSchema.partial();

// Backward-compatible alias
export const AppointmentSchema = AppointmentFormSchema;

// ─── Payment ───────────────────────────────────────────────

export const PaymentSchema = z.object({
    appointment_id: z.string().uuid({ message: 'ID de cita inválido' }),
    amount: z.coerce.number().positive({ message: 'El importe debe ser mayor que 0' }).max(99999),
    method: z.enum(['cash', 'card', 'bizum', 'transfer', 'other'], {
        errorMap: () => ({ message: 'Método de pago inválido' }),
    }),
    paid_at: z.string().datetime({ message: 'Formato de fecha/hora inválido (ISO 8601)' }).optional(),
    notes: z.string().max(500).optional().nullable(),
});

// ─── Schedule Exception ────────────────────────────────────

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const scheduleTimeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

export const ScheduleExceptionSchema = z.object({
    professional_id: z.string().uuid({ message: 'ID de profesional inválido' }),
    exception_date: z.string().regex(dateRegex, { message: 'Formato inválido (YYYY-MM-DD)' }),
    is_available: z.boolean(),
    start_time: z.string().regex(scheduleTimeRegex).nullable().optional(),
    end_time: z.string().regex(scheduleTimeRegex).nullable().optional(),
    reason: z.string().nullable().optional(),
});

// ─── Helpers ───────────────────────────────────────────────

type UnpackErrors<T> = { [K in keyof T]?: string[] };

/**
 * Helper function to parse a Zod schema and format errors for the UI
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: UnpackErrors<T> } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    return {
        success: false,
        errors: result.error.flatten().fieldErrors as UnpackErrors<T>
    };
}
