import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    assertSameOriginMutation,
    ensurePatientAccess,
    getAdminSupabase,
    getProfessionalPatientIds,
    handleApiError,
    normalizeNullableText,
    requirePanelAccess,
    resolveScopedProfessionalId,
    writeAuditLog,
} from '../_lib';
import { checkRateLimit } from '@/lib/rate-limit';

const getPatientsQuerySchema = z.object({
    search: z.string().optional().default(''),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

const patientPayloadSchema = z.object({
    first_name: z.string().min(2).max(50),
    last_name: z.string().min(2).max(100),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    birth_date: z.string().nullable().optional(),
    document_id: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    gdpr_consent: z.boolean().optional(),
    marketing_consent: z.boolean().optional(),
});

const createPatientSchema = patientPayloadSchema.refine((data) => Boolean(normalizeNullableText(data.email) || normalizeNullableText(data.phone)), {
    message: 'Debe proporcionar al menos un correo o número de teléfono',
    path: ['email'],
});

const updatePatientSchema = patientPayloadSchema.partial().extend({
    id: z.string().uuid({ message: 'ID de paciente inválido' }),
}).superRefine((data, ctx) => {
    const emailProvided = data.email === undefined ? true : Boolean(normalizeNullableText(data.email));
    const phoneProvided = data.phone === undefined ? true : Boolean(normalizeNullableText(data.phone));

    if (!emailProvided && !phoneProvided) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Debe proporcionar al menos un correo o número de teléfono',
            path: ['email'],
        });
    }
});

function sanitizeSearchTerm(search: string): string {
    return search
        .replace(/[,%()_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function GET(request: Request) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const url = new URL(request.url);
        const parsed = getPatientsQuerySchema.parse({
            search: url.searchParams.get('search') ?? '',
            page: url.searchParams.get('page') ?? '1',
            pageSize: url.searchParams.get('pageSize') ?? '50',
        });

        const accessiblePatientIds = scopedProfessionalId
            ? await getProfessionalPatientIds(supabase, scopedProfessionalId)
            : null;

        if (accessiblePatientIds && accessiblePatientIds.length === 0) {
            return NextResponse.json({ data: [], count: 0 });
        }

        let query = supabase
            .from('patients')
            .select('*', { count: 'exact' })
            .is('deleted_at', null); // Exclude soft-deleted patients

        if (accessiblePatientIds) {
            query = query.in('id', accessiblePatientIds);
        }

        const safeTerm = sanitizeSearchTerm(parsed.search);
        if (safeTerm) {
            query = query.or(`first_name.ilike.%${safeTerm}%,last_name.ilike.%${safeTerm}%,document_id.ilike.%${safeTerm}%,phone.ilike.%${safeTerm}%`);
        }

        const from = (parsed.page - 1) * parsed.pageSize;
        const to = from + parsed.pageSize - 1;

        const { data, count, error } = await query
            .order('first_name')
            .range(from, to);

        if (error) throw error;

        return NextResponse.json({
            data: data ?? [],
            count: count ?? 0,
        });
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'create-patient', 30, 3600);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
            });
        }
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const rawBody = await request.json();
        const parsed = createPatientSchema.parse(rawBody);

        const payload = {
            ...parsed,
            email: normalizeNullableText(parsed.email),
            phone: normalizeNullableText(parsed.phone),
            birth_date: normalizeNullableText(parsed.birth_date),
            document_id: normalizeNullableText(parsed.document_id),
            address: normalizeNullableText(parsed.address),
        };

        const { data, error } = await supabase
            .from('patients')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        if (scopedProfessionalId) {
            const adminSupabase = getAdminSupabase();
            const { error: assignmentError } = await adminSupabase
                .from('patient_professionals')
                .insert({
                    patient_id: data.id,
                    professional_id: scopedProfessionalId,
                    assigned_by: userId,
                    source: 'manual',
                });

            if (assignmentError) throw assignmentError;
        }

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'patients',
            recordId: data.id,
            details: null,
        });

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function PATCH(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, role, userId, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);
        const rawBody = await request.json();
        const parsed = updatePatientSchema.parse(rawBody);
        const { id, ...updateData } = parsed;

        await ensurePatientAccess({ supabase, role, professionalId: scopedProfessionalId, patientId: id });

        if (updateData.email !== undefined || updateData.phone !== undefined) {
            const { data: currentPatient, error: currentPatientError } = await supabase
                .from('patients')
                .select('email, phone')
                .eq('id', id)
                .maybeSingle();

            if (currentPatientError) throw currentPatientError;
            if (!currentPatient) {
                return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
            }

            const nextEmail = updateData.email === undefined
                ? currentPatient.email
                : normalizeNullableText(updateData.email);
            const nextPhone = updateData.phone === undefined
                ? currentPatient.phone
                : normalizeNullableText(updateData.phone);

            if (!nextEmail && !nextPhone) {
                return NextResponse.json(
                    { error: 'Debe proporcionar al menos un correo o número de teléfono' },
                    { status: 400 }
                );
            }
        }

        const payload = {
            ...updateData,
            email: updateData.email === undefined ? undefined : normalizeNullableText(updateData.email),
            phone: updateData.phone === undefined ? undefined : normalizeNullableText(updateData.phone),
            birth_date: updateData.birth_date === undefined ? undefined : normalizeNullableText(updateData.birth_date),
            document_id: updateData.document_id === undefined ? undefined : normalizeNullableText(updateData.document_id),
            address: updateData.address === undefined ? undefined : normalizeNullableText(updateData.address),
        };

        const cleanPayload = Object.fromEntries(
            Object.entries(payload).filter(([, value]) => value !== undefined)
        );

        if (Object.keys(cleanPayload).length === 0) {
            return NextResponse.json({ success: true, id });
        }

        const { data, error } = await supabase
            .from('patients')
            .update(cleanPayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'UPDATE',
            tableName: 'patients',
            recordId: data.id,
            details: null,
        });

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
