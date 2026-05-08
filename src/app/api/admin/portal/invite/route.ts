import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, getAdminSupabase, handleApiError, requirePanelAccess, writeAuditLog } from '../../_lib';

const InviteSchema = z.object({
    patient_id: z.string().uuid({ message: 'patient_id inválido' }),
});

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess();
        const adminClient = getAdminSupabase();

        const raw = await request.json();
        const parsed = InviteSchema.safeParse(raw);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
        }

        const { patient_id } = parsed.data;

        const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id, email, auth_user_id, first_name, last_name')
            .eq('id', patient_id)
            .is('deleted_at', null)
            .single();

        if (patientError || !patient) {
            return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
        }
        if (!patient.email) {
            return NextResponse.json({ error: 'El paciente no tiene email registrado' }, { status: 422 });
        }
        if (patient.auth_user_id) {
            return NextResponse.json({ error: 'El paciente ya tiene cuenta en el portal' }, { status: 409 });
        }

        const portalUrl = process.env.PORTAL_ORIGIN ?? process.env.PORTAL_URL;
        if (!portalUrl) {
            return NextResponse.json({ error: 'Configuración de portal no disponible' }, { status: 503 });
        }
        const portalOrigin = process.env.PORTAL_ORIGIN ?? new URL(portalUrl).origin;
        const redirectTo = `${portalOrigin}/auth/callback?next=/portal/completar-perfil`;

        const { error: inviteError } = await adminClient.auth.admin.generateLink({
            type: 'invite',
            email: patient.email,
            options: { redirectTo },
        });

        if (inviteError) {
            console.error('Error generating invite link:', inviteError);
            return NextResponse.json({ error: 'Error al generar la invitación' }, { status: 500 });
        }

        await writeAuditLog({
            supabase,
            userId,
            action: 'CREATE',
            tableName: 'portal_invite',
            recordId: patient_id,
            details: { email: patient.email, patient_name: `${patient.first_name} ${patient.last_name}` },
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        return handleApiError(err);
    }
}
