import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CompleteProfileForm } from './CompleteProfileForm';

export default async function CompletarPerfilPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/portal/login');
    }

    // Already linked → skip
    const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .maybeSingle();

    if (patient) {
        redirect('/portal/mis-citas');
    }

    return (
        <div className="portal-shell">
            <div className="portal-onboarding">
                <div className="portal-onboarding__card">
                    <div className="portal-onboarding__header">
                        <div className="portal-cover-logo__mark" style={{ fontSize: 20, width: 40, height: 40 }}>Z</div>
                        <h1>Completa tu perfil</h1>
                        <p>Necesitamos tus datos para vincular tu cuenta con tu historial en la clínica.</p>
                    </div>
                    <CompleteProfileForm userEmail={user.email ?? ''} />
                </div>
            </div>
        </div>
    );
}
