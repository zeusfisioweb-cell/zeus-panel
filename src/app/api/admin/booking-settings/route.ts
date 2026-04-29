import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOriginMutation, handleApiError, normalizeNullableText, requirePanelAccess, writeAuditLog } from '../_lib';
import { checkRateLimit } from '@/lib/rate-limit';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

const updateBookingSettingsSchema = z.object({
    clinic_name: z.string().min(1),
    phone: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().nullable().optional(),
    booking_advance_days: z.number().int().min(1).max(365),
    min_booking_notice_hours: z.number().int().min(0).max(168),
    cancellation_hours: z.number().int().min(0).max(168),
    slot_interval_minutes: z.number().int().min(5).max(240),
    buffer_minutes: z.number().int().min(0).max(180),
    gdpr_text: z.string().nullable().optional(),
    informed_consent_text: z.string().nullable().optional(),
    privacy_policy_url: z.string().url().nullable().optional(),
    terms_url: z.string().url().nullable().optional(),
    opening_hour: z.string().regex(timeRegex, { message: 'Formato inválido (HH:MM)' }),
    closing_hour: z.string().regex(timeRegex, { message: 'Formato inválido (HH:MM)' }),
}).refine((data) => data.closing_hour > data.opening_hour, {
    message: 'La hora de cierre debe ser posterior a la de apertura',
    path: ['closing_hour'],
});

export async function GET() {
    try {
        const { supabase } = await requirePanelAccess();
        const { data, error } = await supabase
            .from('booking_settings')
            .select('*')
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ error: 'Booking settings not configured' }, { status: 404 });
        }
        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function PATCH(request: Request) {
    try {
        assertSameOriginMutation(request);
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const rl = await checkRateLimit(ip, 'update-booking-settings', 10, 3600);
        if (!rl.success) {
            return NextResponse.json({ error: 'Too many requests' }, {
                status: 429,
                headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) },
            });
        }
        const { supabase, userId } = await requirePanelAccess({ ownerOnly: true });
        const currentSettingsRes = await supabase
            .from('booking_settings')
            .select('id')
            .limit(1)
            .maybeSingle();

        if (currentSettingsRes.error) throw currentSettingsRes.error;
        if (!currentSettingsRes.data) {
            return NextResponse.json({ error: 'Booking settings not configured' }, { status: 404 });
        }

        const rawBody = await request.json();
        const parsed = updateBookingSettingsSchema.parse(rawBody);

        const payload = {
            ...parsed,
            phone: normalizeNullableText(parsed.phone),
            email: normalizeNullableText(parsed.email),
            address: normalizeNullableText(parsed.address),
            gdpr_text: normalizeNullableText(parsed.gdpr_text),
            informed_consent_text: normalizeNullableText(parsed.informed_consent_text),
            privacy_policy_url: normalizeNullableText(parsed.privacy_policy_url),
            terms_url: normalizeNullableText(parsed.terms_url),
        };

        const { data, error } = await supabase
            .from('booking_settings')
            .update(payload)
            .eq('id', currentSettingsRes.data.id)
            .select()
            .single();

        if (error) throw error;

        await writeAuditLog({
            supabase,
            userId,
            action: 'UPDATE',
            tableName: 'booking_settings',
            recordId: data.id as string,
            details: null,
        });

        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
