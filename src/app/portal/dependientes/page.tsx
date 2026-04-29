import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/app/api/admin/_lib';
import { redirect } from 'next/navigation';
import { PortalSignOutButton } from '../mis-citas/PortalSignOutButton';
import { DependientesClient } from './DependientesClient';

function getAge(birthDate: string): number {
    const today = new Date();
    const dob = new Date(birthDate);
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    return age;
}

export default async function DependientesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/portal/login');

    const adminSupabase = getAdminSupabase();

    const [{ data: patientData }, { data: rawDeps }] = await Promise.all([
        adminSupabase
            .from('patients')
            .select('id, first_name, last_name')
            .eq('auth_user_id', user.id)
            .is('deleted_at', null)
            .maybeSingle(),
        adminSupabase
            .from('patients')
            .select('id, first_name, last_name, birth_date, phone, document_id')
            .eq('guardian_auth_user_id', user.id)
            .is('deleted_at', null)
            .order('first_name'),
    ]);

    if (!patientData) redirect('/portal/completar-perfil');

    const dependientes = (rawDeps ?? []).map(p => ({
        ...p,
        age: p.birth_date ? getAge(p.birth_date) : null,
        approaching_autonomy: p.birth_date ? getAge(p.birth_date) >= 15 : false,
        autonomous: p.birth_date ? getAge(p.birth_date) >= 16 : false,
    }));

    return (
        <div className="portal-page">
            <header className="portal-header">
                <div className="portal-header__brand">
                    <span className="portal-header__logo">Z</span>
                    <span className="portal-header__title">Portal del Paciente</span>
                </div>
                <div className="portal-header__user">
                    <a href="/portal/mis-citas" className="btn btn--ghost btn--sm">Mis citas</a>
                    <span className="portal-header__name">{patientData.first_name} {patientData.last_name}</span>
                    <PortalSignOutButton />
                </div>
            </header>

            <main className="portal-main">
                <section className="portal-section">
                    <DependientesClient dependientes={dependientes} />
                </section>
                <footer className="portal-footer">
                    <p>Los menores de 16 años requieren tutela legal según la Ley 41/2002.</p>
                </footer>
            </main>
        </div>
    );
}
