import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiRouteError, handleApiError, requirePanelAccess, resolveScopedProfessionalId } from '../_lib';

const statusQuery = z.enum(['pending', 'accepted', 'declined', 'expired', 'cancelled', 'all']).optional();

interface RawRow {
    id: string;
    patient_id: string;
    professional_id: string;
    service_id: string;
    preferred_date: string;
    notes: string | null;
    status: string;
    created_at: string;
    resolved_at: string | null;
    resolution_note: string | null;
    service: { name: string } | { name: string }[] | null;
    professional: { profile: { full_name: string | null } | { full_name: string | null }[] | null } | { profile: { full_name: string | null } | { full_name: string | null }[] | null }[] | null;
    patient: { id: string; first_name: string | null; last_name: string | null; phone: string | null } | { id: string; first_name: string | null; last_name: string | null; phone: string | null }[] | null;
}

function buildPatientName(first: string | null, last: string | null): string | null {
    const joined = [first, last].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(' ');
    return joined.length > 0 ? joined : null;
}

export async function GET(request: Request) {
    try {
        const { supabase, role, professionalId } = await requirePanelAccess();
        const scopedProfessionalId = resolveScopedProfessionalId(role, professionalId);

        const url = new URL(request.url);
        const statusParam = statusQuery.parse(url.searchParams.get('status') ?? undefined);

        let query = supabase
            .from('appointment_requests')
            .select(`
                id,
                patient_id,
                professional_id,
                service_id,
                preferred_date,
                notes,
                status,
                created_at,
                resolved_at,
                resolution_note,
                service:services(name),
                professional:professionals(profile:profiles(full_name)),
                patient:patients(id, first_name, last_name, phone)
            `)
            .order('preferred_date', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(200);

        if (!statusParam || statusParam === 'pending') {
            query = query.eq('status', 'pending');
        } else if (statusParam !== 'all') {
            query = query.eq('status', statusParam);
        }

        if (scopedProfessionalId) {
            query = query.eq('professional_id', scopedProfessionalId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const rows = (data ?? []) as RawRow[];
        const requests = rows.map((row) => {
            const svc = Array.isArray(row.service) ? row.service[0] : row.service;
            const proWrap = Array.isArray(row.professional) ? row.professional[0] : row.professional;
            const proProfile = proWrap?.profile;
            const proProfileResolved = Array.isArray(proProfile) ? proProfile[0] : proProfile;
            const pat = Array.isArray(row.patient) ? row.patient[0] : row.patient;
            return {
                id: row.id,
                patient_id: row.patient_id,
                patient_name: pat ? buildPatientName(pat.first_name, pat.last_name) : null,
                patient_phone: pat?.phone ?? null,
                professional_id: row.professional_id,
                professional_name: proProfileResolved?.full_name ?? null,
                service_id: row.service_id,
                service_name: svc?.name ?? null,
                preferred_date: row.preferred_date,
                notes: row.notes,
                status: row.status,
                created_at: row.created_at,
                resolved_at: row.resolved_at,
                resolution_note: row.resolution_note,
            };
        });

        return NextResponse.json({ requests });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return handleApiError(new ApiRouteError(400, 'Invalid status filter'));
        }
        return handleApiError(error);
    }
}
