import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import type { BookingSettings, UserRole } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

export function getAdminSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new ApiRouteError(500, 'Admin client not configured');
    }

    return createSupabaseAdmin(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

type PanelSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export class ApiRouteError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

interface RequirePanelAccessOptions {
    ownerOnly?: boolean;
}

interface PanelAccessContext {
    role: UserRole;
    userId: string;
    professionalId: string | null;
    supabase: PanelSupabaseClient;
}

interface WriteAuditLogParams {
    supabase: PanelSupabaseClient;
    userId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW';
    tableName: string;
    recordId: string;
    details?: Record<string, unknown> | null;
}

interface PatientAccessParams {
    supabase: PanelSupabaseClient;
    role: UserRole;
    professionalId: string | null;
    patientId: string;
}

export function assertSameOriginMutation(request: Request): void {
    const secFetchSite = request.headers.get('sec-fetch-site');
    if (secFetchSite === 'cross-site') {
        throw new ApiRouteError(403, 'Forbidden');
    }

    const origin = request.headers.get('origin');
    if (!origin) {
        return;
    }

    let originUrl: URL;
    try {
        originUrl = new URL(origin);
    } catch {
        throw new ApiRouteError(403, 'Forbidden');
    }

    // Prefer env-pinned APP_URL to avoid host-header injection via x-forwarded-host
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    let expectedOrigin: string;
    if (appUrl) {
        expectedOrigin = new URL(appUrl).origin.toLowerCase();
    } else {
        if (process.env.NODE_ENV === 'production') {
            throw new ApiRouteError(500, 'App URL not configured');
        }

        const requestUrl = new URL(request.url);
        const host = request.headers.get('x-forwarded-host')
            ?? request.headers.get('host')
            ?? requestUrl.host;
        const protocol = request.headers.get('x-forwarded-proto')
            ?? requestUrl.protocol.replace(':', '');
        expectedOrigin = `${protocol}://${host}`.toLowerCase();
    }

    if (originUrl.origin.toLowerCase() !== expectedOrigin) {
        throw new ApiRouteError(403, 'Forbidden');
    }
}

export function resolveScopedProfessionalId(
    role: UserRole,
    professionalId: string | null
): string | null {
    if (role !== 'professional') return null;
    if (!professionalId) {
        throw new ApiRouteError(403, 'Forbidden');
    }

    return professionalId;
}

export async function requirePanelAccess(
    options: RequirePanelAccessOptions = {}
): Promise<PanelAccessContext> {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new ApiRouteError(401, 'Unauthorized');
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || !profile) {
        throw new ApiRouteError(403, 'Forbidden');
    }

    const role = profile.role as UserRole;
    if (role !== 'owner' && role !== 'professional') {
        throw new ApiRouteError(403, 'Forbidden');
    }

    let professionalId: string | null = null;

    if (role === 'professional') {
        const { data: professional, error: professionalError } = await supabase
            .from('professionals')
            .select('id, is_active')
            .eq('user_id', user.id)
            .maybeSingle();

        if (professionalError || !professional || !professional.is_active) {
            throw new ApiRouteError(403, 'Forbidden');
        }

        professionalId = professional.id as string;
    }

    if (options.ownerOnly && role !== 'owner') {
        throw new ApiRouteError(403, 'Forbidden: owner role required');
    }

    return {
        role,
        userId: user.id,
        professionalId,
        supabase,
    };
}

export function handleApiError(error: unknown): NextResponse {
    if (error instanceof ApiRouteError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
        return NextResponse.json(
            {
                error: 'Invalid request data',
                details: error.flatten().fieldErrors,
            },
            { status: 400 }
        );
    }

    console.error('[admin-api] Unhandled error:', error);
    const message = process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
}

export function normalizeNullableText(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export async function getProfessionalPatientIds(
    supabase: PanelSupabaseClient,
    professionalId: string
): Promise<string[]> {
    const [assignmentsRes, appointmentsRes, recordsRes] = await Promise.all([
        supabase
            .from('patient_professionals')
            .select('patient_id')
            .eq('professional_id', professionalId),
        supabase
            .from('appointments')
            .select('patient_id')
            .eq('professional_id', professionalId)
            .not('patient_id', 'is', null),
        supabase
            .from('clinical_records')
            .select('patient_id')
            .eq('professional_id', professionalId),
    ]);

    if (assignmentsRes.error) throw assignmentsRes.error;
    if (appointmentsRes.error) throw appointmentsRes.error;
    if (recordsRes.error) throw recordsRes.error;

    const ids = new Set<string>();
    for (const row of assignmentsRes.data ?? []) {
        if (typeof row.patient_id === 'string') ids.add(row.patient_id);
    }
    for (const row of appointmentsRes.data ?? []) {
        if (typeof row.patient_id === 'string') ids.add(row.patient_id);
    }
    for (const row of recordsRes.data ?? []) {
        if (typeof row.patient_id === 'string') ids.add(row.patient_id);
    }

    return [...ids];
}

export async function ensurePatientAccess({
    supabase,
    role,
    professionalId,
    patientId,
}: PatientAccessParams): Promise<void> {
    const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('id, deleted_at')
        .eq('id', patientId)
        .maybeSingle();

    if (patientError) throw patientError;
    if (!patient || patient.deleted_at) {
        throw new ApiRouteError(404, 'Patient not found');
    }

    if (role === 'owner') return;

    if (role !== 'professional' || !professionalId) {
        throw new ApiRouteError(403, 'Forbidden');
    }

    const { data: assignment, error: assignmentError } = await supabase
        .from('patient_professionals')
        .select('patient_id')
        .eq('patient_id', patientId)
        .eq('professional_id', professionalId)
        .limit(1)
        .maybeSingle();

    if (assignmentError) throw assignmentError;
    if (assignment) return;

    const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', patientId)
        .eq('professional_id', professionalId)
        .limit(1)
        .maybeSingle();

    if (appointmentError) throw appointmentError;
    if (appointment) return;

    const { data: record, error: recordError } = await supabase
        .from('clinical_records')
        .select('id')
        .eq('patient_id', patientId)
        .eq('professional_id', professionalId)
        .limit(1)
        .maybeSingle();

    if (recordError) throw recordError;
    if (record) return;

    throw new ApiRouteError(403, 'Forbidden');
}

export async function getBookingSettings(supabase: PanelSupabaseClient): Promise<BookingSettings> {
    const { data, error } = await supabase
        .from('booking_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error || !data) {
        throw new ApiRouteError(500, 'Booking settings not configured');
    }

    return data as BookingSettings;
}

export async function writeAuditLog({
    supabase,
    userId,
    action,
    tableName,
    recordId,
    details = null,
}: WriteAuditLogParams): Promise<void> {
    const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        action,
        table_name: tableName,
        record_id: recordId,
        details,
    });

    if (error) {
        console.error('[admin-api] Failed to write audit log:', error.message);
        throw new ApiRouteError(500, 'Audit log failed');
    }
}
