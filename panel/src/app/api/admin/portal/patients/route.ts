import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
    ApiRouteError,
    assertSameOriginMutation,
    getAdminSupabase,
    handleApiError,
    requirePanelAccess,
    writeAuditLog,
} from '@/app/api/admin/_lib';
const revokePortalAccessSchema = z.object({
    patient_id: z.string().uuid({ message: 'patient_id inválido' }),
});

export async function GET() {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });

        const { data, error } = await supabase
            .from('patients')
            .select('id, first_name, last_name, email, phone, auth_user_id, created_at')
            .is('deleted_at', null)
            .order('last_name', { ascending: true })
            .order('first_name', { ascending: true });

        if (error) throw new ApiRouteError(500, error.message);

        return NextResponse.json(data ?? []);
    } catch (err) {
        if (err instanceof ApiRouteError) {
            return NextResponse.json({ error: err.message }, { status: err.status });
        }
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const { searchParams } = new URL(request.url);
        const parsed = revokePortalAccessSchema.safeParse({
            patient_id: searchParams.get('patient_id'),
        });
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'patient_id requerido' }, { status: 400 });
        }
        const patientId = parsed.data.patient_id;

        // Remove portal access: clear auth_user_id + optionally delete auth user
        const adminSupabase = getAdminSupabase();

        const { data: patient, error: fetchErr } = await supabase
            .from('patients')
            .select('auth_user_id')
            .eq('id', patientId)
            .single();

        if (fetchErr || !patient) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });

        const authUserId = patient.auth_user_id;
        const { error: updateErr } = await supabase
            .from('patients')
            .update({ auth_user_id: null })
            .eq('id', patientId);

        if (updateErr) throw new ApiRouteError(500, updateErr.message);

        if (authUserId) {
            // Revoke auth access after unlinking. If auth deletion fails, rollback the unlink.
            const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(authUserId);
            if (deleteAuthError) {
                const { error: rollbackError } = await supabase
                    .from('patients')
                    .update({ auth_user_id: authUserId })
                    .eq('id', patientId);
                if (rollbackError) {
                    console.error('[portal-patients] Failed to rollback auth unlink:', rollbackError.message);
                }
                throw new ApiRouteError(500, 'No fue posible revocar acceso de autenticación');
            }
        }

        await writeAuditLog({
            supabase,
            userId,
            action: 'DELETE',
            tableName: 'portal_access',
            recordId: patientId,
            details: { revoked: true, had_auth_user: Boolean(authUserId) },
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        return handleApiError(err);
    }
}
