import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, normalizeNullableText, requirePanelAccess } from '../_lib';

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
    opening_hour: z.string().min(1),
    closing_hour: z.string().min(1),
});

export async function GET() {
    try {
        const { supabase } = await requirePanelAccess();
        const { data, error } = await supabase
            .from('booking_settings')
            .select('*')
            .limit(1)
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}

export async function PATCH(request: Request) {
    try {
        const { supabase } = await requirePanelAccess({ ownerOnly: true });
        const currentSettingsRes = await supabase
            .from('booking_settings')
            .select('id')
            .limit(1)
            .single();

        if (currentSettingsRes.error || !currentSettingsRes.data) {
            throw currentSettingsRes.error ?? new Error('booking_settings row not found');
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
        return NextResponse.json(data);
    } catch (error: unknown) {
        return handleApiError(error);
    }
}
