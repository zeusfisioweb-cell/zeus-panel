import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiRouteError, assertSameOriginMutation, getAdminSupabase, handleApiError } from '@/app/api/admin/_lib';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';

const createDependienteSchema = z.object({
    first_name: z.string().min(1).max(100),
    last_name: z.string().min(1).max(100),
    birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
    phone: z.string().max(20).optional(),
    document_id: z.string().max(20).optional(),
    gdpr_consented_by_guardian: z.literal(true, {
        errorMap: () => ({ message: 'Debes aceptar el consentimiento como tutor legal' }),
    }),
});

function getAge(birthDate: string): number {
    const today = new Date();
    const dob = new Date(birthDate);
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    return age;
}

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const adminSupabase = getAdminSupabase();

    const { data, error } = await adminSupabase
        .from('patients')
        .select('id, first_name, last_name, birth_date, phone, document_id')
        .eq('guardian_auth_user_id', user.id)
        .is('deleted_at', null)
        .order('first_name');

    if (error) return NextResponse.json({ error: 'Error al obtener dependientes' }, { status: 500 });

    // Enrich with age and autonomy flag
    const dependientes = (data ?? []).map(p => ({
        ...p,
        age: p.birth_date ? getAge(p.birth_date) : null,
        approaching_autonomy: p.birth_date ? getAge(p.birth_date) >= 15 : false,
        autonomous: p.birth_date ? getAge(p.birth_date) >= 16 : false,
    }));

    return NextResponse.json({ dependientes });
}

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'portal-create-dependiente', 8, 3600);
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
        if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const body = await request.json();
        const parsed = createDependienteSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 });
        }

        const { first_name, last_name, birth_date, phone, document_id } = parsed.data;
        const adminSupabase = getAdminSupabase();

        // Guardian must be a linked patient themselves
        const { data: guardian } = await adminSupabase
            .from('patients')
            .select('id')
            .eq('auth_user_id', user.id)
            .is('deleted_at', null)
            .maybeSingle();

        if (!guardian) {
            return NextResponse.json({ error: 'Debes completar tu propio perfil antes de añadir dependientes' }, { status: 403 });
        }

        const age = getAge(birth_date);
        if (age >= 16) {
            return NextResponse.json({ error: 'El dependiente tiene 16 años o más y debe registrarse de forma independiente' }, { status: 400 });
        }

        const { data: created, error: createErr } = await adminSupabase
            .from('patients')
            .insert({
                first_name,
                last_name,
                birth_date,
                phone: phone ?? null,
                document_id: document_id?.toUpperCase() ?? null,
                guardian_auth_user_id: user.id,
                gdpr_consent: true,
                gdpr_consented_by_guardian: true,
                auth_user_id: null,
            })
            .select('id')
            .single();

        if (createErr) {
            return NextResponse.json({ error: 'Error al crear dependiente' }, { status: 500 });
        }

        const { error: auditError } = await adminSupabase.from('audit_logs').insert({
            user_id: user.id,
            action: 'CREATE',
            table_name: 'patients',
            record_id: created.id,
            details: { source: 'portal_dependiente_create', guardian_auth_user_id: user.id },
        });
        if (auditError) {
            throw new ApiRouteError(500, 'Audit log failed');
        }

        return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
    } catch (error) {
        return handleApiError(error);
    }
}
