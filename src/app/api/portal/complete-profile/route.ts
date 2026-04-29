import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiRouteError, assertSameOriginMutation, getAdminSupabase, handleApiError } from '@/app/api/admin/_lib';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const DNI_NIE_REGEX = /^[0-9XYZ]\d{7}[A-Z]$/i;

const schema = z.object({
    first_name: z.string().min(1).max(100),
    last_name: z.string().min(1).max(100),
    document_id: z.string().regex(DNI_NIE_REGEX, 'Formato DNI/NIE inválido (ej: 12345678A)'),
    phone: z.string().max(20).optional(),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    gdpr_consent: z.boolean(),
});

async function writePortalAuditLog(params: {
    adminSupabase: ReturnType<typeof getAdminSupabase>;
    userId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    recordId: string;
    details: Record<string, unknown>;
}): Promise<void> {
    const { error } = await params.adminSupabase.from('audit_logs').insert({
        user_id: params.userId,
        action: params.action,
        table_name: 'patients',
        record_id: params.recordId,
        details: params.details,
    });

    if (error) {
        throw new ApiRouteError(500, 'Audit log failed');
    }
}

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'portal-complete-profile', 8, 3600);
        if (!rl.success) {
            return NextResponse.json(
                { error: 'Too many requests' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
                }
            );
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
            const message = parsed.error.issues[0]?.message ?? 'Datos inválidos';
            return NextResponse.json({ error: message }, { status: 400 });
        }

        const { first_name, last_name, document_id, phone, birth_date, gdpr_consent } = parsed.data;

        // Ley 41/2002: menores de 16 no pueden registrarse de forma autónoma
        const dob = new Date(birth_date);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
        if (age < 16) {
            return NextResponse.json(
                { error: 'Los menores de 16 años no pueden registrarse de forma independiente. Pide a tu tutor legal que te añada como dependiente desde su cuenta.' },
                { status: 403 },
            );
        }

        const adminSupabase = getAdminSupabase();

        // Already linked — idempotent
        const { data: existing } = await adminSupabase
            .from('patients')
            .select('id')
            .eq('auth_user_id', user.id)
            .is('deleted_at', null)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ ok: true, linked: existing.id });
        }

        // Match by DNI only — email is contact info, not identity
        const { data: matched } = await adminSupabase
            .from('patients')
            .select('id, auth_user_id, first_name, last_name, birth_date')
            .eq('document_id', document_id.toUpperCase())
            .is('deleted_at', null)
            .maybeSingle();

        if (matched) {
            if (matched.auth_user_id && matched.auth_user_id !== user.id) {
                return NextResponse.json(
                    { error: 'Este documento ya está vinculado a otra cuenta. Contacta con la clínica.' },
                    { status: 409 },
                );
            }

            const incomingFirstName = first_name.trim().toLowerCase();
            const incomingLastName = last_name.trim().toLowerCase();
            const incomingBirthDate = birth_date;
            const currentFirstName = (matched.first_name ?? '').trim().toLowerCase();
            const currentLastName = (matched.last_name ?? '').trim().toLowerCase();
            const currentBirthDate = matched.birth_date ?? '';

            if (
                currentFirstName !== incomingFirstName
                || currentLastName !== incomingLastName
                || currentBirthDate !== incomingBirthDate
            ) {
                throw new ApiRouteError(403, 'Los datos no coinciden con el registro existente. Contacta con la clínica.');
            }

            // Only fill fields that are empty in the existing record — admin data takes precedence
            const updatePayload: Record<string, unknown> = {
                auth_user_id: user.id,
                email: user.email ?? undefined,
                phone: phone ?? undefined,
                gdpr_consent,
                updated_at: new Date().toISOString(),
            };
            if (!matched.first_name) updatePayload.first_name = first_name;
            if (!matched.last_name) updatePayload.last_name = last_name;
            if (!matched.birth_date && birth_date) updatePayload.birth_date = birth_date;

            const { error: updateErr } = await adminSupabase
                .from('patients')
                .update(updatePayload)
                .eq('id', matched.id);

            if (updateErr) {
                return NextResponse.json({ error: 'Error al vincular perfil' }, { status: 500 });
            }

            await writePortalAuditLog({
                adminSupabase,
                userId: user.id,
                action: 'UPDATE',
                recordId: matched.id,
                details: { source: 'portal_complete_profile', linked_existing: true },
            });

            return NextResponse.json({ ok: true, linked: matched.id });
        }

        // No match — create new patient record
        const { data: created, error: createErr } = await adminSupabase
            .from('patients')
            .insert({
                first_name,
                last_name,
                document_id: document_id.toUpperCase(),
                phone: phone ?? null,
                email: user.email ?? null,
                birth_date: birth_date ?? null,
                auth_user_id: user.id,
                gdpr_consent,
            })
            .select('id')
            .single();

        if (createErr) {
            // Race condition: another request inserted same DNI between our lookup and insert
            if (createErr.code === '23505') {
                return NextResponse.json(
                    { error: 'Este documento ya está registrado. Contacta con la clínica.' },
                    { status: 409 },
                );
            }
            return NextResponse.json({ error: 'Error al crear perfil' }, { status: 500 });
        }

        await writePortalAuditLog({
            adminSupabase,
            userId: user.id,
            action: 'CREATE',
            recordId: created.id,
            details: { source: 'portal_complete_profile', created_new: true },
        });

        return NextResponse.json({ ok: true, created: created.id });
    } catch (error) {
        return handleApiError(error);
    }
}
