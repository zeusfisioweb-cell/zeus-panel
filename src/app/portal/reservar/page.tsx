import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/app/api/admin/_lib';
import { ReservarClient } from './ReservarClient';
import type { BookingSettings, ServiceCategory } from '@/lib/types';

function getAge(birthDate: string): number {
    const today = new Date();
    const dob = new Date(birthDate);
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    return age;
}

export default async function ReservarPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/portal/login');

    const admin = getAdminSupabase();

    const [selfRes, depsRes, categoriesRes, settingsRes] = await Promise.all([
        admin.from('patients').select('id, first_name, last_name, phone, email').eq('auth_user_id', user.id).is('deleted_at', null).maybeSingle(),
        admin.from('patients').select('id, first_name, last_name, birth_date').eq('guardian_auth_user_id', user.id).is('deleted_at', null).order('first_name'),
        admin.from('service_categories').select('id, name, slug, description, icon, color, display_order').eq('is_active', true).order('display_order'),
        admin.from('booking_settings').select('booking_advance_days, min_booking_notice_hours, slot_interval_minutes, gdpr_text, informed_consent_text, cancellation_hours').limit(1).maybeSingle(),
    ]);

    if (!selfRes.data) redirect('/portal/completar-perfil');

    const activeDependientes = (depsRes.data ?? []).filter(d => d.birth_date && getAge(d.birth_date) < 16);

    return (
        <ReservarClient
            self={selfRes.data}
            dependientes={activeDependientes}
            categories={(categoriesRes.data ?? []) as ServiceCategory[]}
            settings={settingsRes.data as BookingSettings | null}
        />
    );
}
