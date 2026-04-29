import { createClient } from '@/lib/supabase/server';
import { getAdminSupabase } from '@/app/api/admin/_lib';
import { redirect } from 'next/navigation';
import { PortalSignOutButton } from './PortalSignOutButton';
import { CancelAppointmentButton } from './CancelAppointmentButton';

type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

interface PortalAppointment {
    id: string;
    start_time: string;
    end_time: string;
    status: AppointmentStatus;
    notes: string | null;
    professional: {
        color_code: string;
        specialty: string | null;
        profile: { full_name: string | null } | null;
    } | null;
    service: {
        name: string;
        duration_minutes: number;
    } | null;
}

interface PatientGroup {
    id: string;
    name: string;
    isSelf: boolean;
    approaching_autonomy: boolean;
    upcoming: PortalAppointment[];
    past: PortalAppointment[];
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    completed: 'Completada',
};

const STATUS_CLASS: Record<AppointmentStatus, string> = {
    pending: 'portal-badge--warning',
    confirmed: 'portal-badge--success',
    cancelled: 'portal-badge--muted',
    completed: 'portal-badge--info',
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-ES', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function isUpcoming(iso: string) { return new Date(iso) > new Date(); }

function getAge(birthDate: string): number {
    const today = new Date();
    const dob = new Date(birthDate);
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    return age;
}

async function fetchAppointmentsForPatient(
    supabase: ReturnType<typeof getAdminSupabase>,
    patientId: string,
): Promise<PortalAppointment[]> {
    const { data } = await supabase
        .from('appointments')
        .select(`
            id, start_time, end_time, status, notes,
            professional:professionals (
                color_code, specialty,
                profile:profiles ( full_name )
            ),
            service:services ( name, duration_minutes )
        `)
        .eq('patient_id', patientId)
        .neq('status', 'cancelled')
        .order('start_time', { ascending: false })
        .limit(50);
    return (data ?? []) as unknown as PortalAppointment[];
}

export default async function MisCitasPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/portal/login');

    const adminSupabase = getAdminSupabase();

    // Fetch own patient (explicit filter — avoids ambiguity with guardian RLS)
    const { data: self } = await adminSupabase
        .from('patients')
        .select('id, first_name, last_name, email, phone')
        .eq('auth_user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

    if (!self) redirect('/portal/completar-perfil');

    // Fetch active dependientes (< 16 years)
    const { data: rawDeps } = await adminSupabase
        .from('patients')
        .select('id, first_name, last_name, birth_date')
        .eq('guardian_auth_user_id', user.id)
        .is('deleted_at', null)
        .order('first_name');

    const activeDeps = (rawDeps ?? []).filter(d => d.birth_date && getAge(d.birth_date) < 16);
    const approachingDeps = activeDeps.filter(d => d.birth_date && getAge(d.birth_date) >= 15);

    const { data: settings } = await adminSupabase
        .from('booking_settings')
        .select('cancellation_hours')
        .limit(1)
        .maybeSingle();
    const cancellationHours = settings?.cancellation_hours ?? 24;

    // Fetch appointments for self + active dependientes in parallel
    const [selfApts, ...depApts] = await Promise.all([
        fetchAppointmentsForPatient(adminSupabase, self.id),
        ...activeDeps.map(d => fetchAppointmentsForPatient(adminSupabase, d.id)),
    ]);

    const groups: PatientGroup[] = [
        {
            id: self.id,
            name: `${self.first_name} ${self.last_name}`,
            isSelf: true,
            approaching_autonomy: false,
            upcoming: selfApts.filter(a => isUpcoming(a.start_time) && a.status !== 'completed'),
            past: selfApts.filter(a => !isUpcoming(a.start_time) || a.status === 'completed').slice(0, 10),
        },
        ...activeDeps.map((dep, i) => ({
            id: dep.id,
            name: `${dep.first_name} ${dep.last_name}`,
            isSelf: false,
            approaching_autonomy: approachingDeps.some(d => d.id === dep.id),
            upcoming: depApts[i].filter(a => isUpcoming(a.start_time) && a.status !== 'completed'),
            past: depApts[i].filter(a => !isUpcoming(a.start_time) || a.status === 'completed').slice(0, 5),
        })),
    ];


    return (
        <div className="portal-page">
            <header className="portal-header">
                <div className="portal-header__brand">
                    <span className="portal-header__logo">Z</span>
                    <span className="portal-header__title">Portal del Paciente</span>
                </div>
                <div className="portal-header__user">
                    {activeDeps.length > 0 && (
                        <a href="/portal/dependientes" className="btn btn--ghost btn--sm">
                            Mis dependientes ({activeDeps.length})
                        </a>
                    )}
                    <a href="/portal/dependientes" className="btn btn--ghost btn--sm">+ Añadir hijo/a</a>
                    <a href="/portal/reservar" className="btn btn--primary btn--sm">Reservar cita</a>
                    <span className="portal-header__name">{self.first_name} {self.last_name}</span>
                    <PortalSignOutButton />
                </div>
            </header>

            <main className="portal-main">
                {groups.map(group => (
                    <div key={group.id}>
                        {!group.isSelf && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2rem', marginBottom: '0.5rem' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Citas de {group.name}
                                </h3>
                                {group.approaching_autonomy && (
                                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>
                                        Próximo a autonomía sanitaria (16 años)
                                    </span>
                                )}
                            </div>
                        )}

                        <section className="portal-section">
                            <div className="portal-section__head">
                                <h2 className="portal-section__title">
                                    {group.isSelf ? 'Próximas citas' : 'Próximas'}
                                </h2>
                                <span className="portal-section__count">{group.upcoming.length}</span>
                            </div>

                            {group.upcoming.length === 0 ? (
                                <div className="portal-empty">
                                    <p>No hay citas próximas{!group.isSelf ? ` para ${group.name}` : ''}.</p>
                                    <p className="portal-empty__hint">Llama a la clínica para reservar una cita.</p>
                                </div>
                            ) : (
                                <ul className="portal-apt-list">
                                    {group.upcoming.map(apt => (
                                        <AppointmentCard key={apt.id} apt={apt} cancellationHours={cancellationHours} />
                                    ))}
                                </ul>
                            )}
                        </section>

                        {group.past.length > 0 && (
                            <section className="portal-section portal-section--past">
                                <div className="portal-section__head">
                                    <h2 className="portal-section__title">Historial reciente</h2>
                                    <span className="portal-section__count">{group.past.length}</span>
                                </div>
                                <ul className="portal-apt-list portal-apt-list--past">
                                    {group.past.map(apt => (
                                        <AppointmentCard key={apt.id} apt={apt} muted cancellationHours={cancellationHours} />
                                    ))}
                                </ul>
                            </section>
                        )}
                    </div>
                ))}

                <footer className="portal-footer">
                    <p>¿Necesitas cambiar una cita? Llámanos directamente.</p>
                </footer>
            </main>
        </div>
    );
}

function AppointmentCard({
    apt, muted, cancellationHours,
}: {
    apt: PortalAppointment;
    muted?: boolean;
    cancellationHours: number;
}) {
    const professionalName = apt.professional?.profile?.full_name ?? 'Profesional';
    const serviceName = apt.service?.name ?? 'Consulta';
    const accentColor = apt.professional?.color_code ?? 'var(--brand-canela)';
    const isCancellable = !muted && (apt.status === 'pending' || apt.status === 'confirmed');

    return (
        <li className={`portal-apt-card${muted ? ' portal-apt-card--muted' : ''}`}
            style={{ '--apt-color': accentColor } as React.CSSProperties}>
            <div className="portal-apt-card__accent" />
            <div className="portal-apt-card__body">
                <div className="portal-apt-card__datetime">
                    <span className="portal-apt-card__date">{formatDate(apt.start_time)}</span>
                    <span className="portal-apt-card__time">{formatTime(apt.start_time)} — {formatTime(apt.end_time)}</span>
                </div>
                <div className="portal-apt-card__info">
                    <strong className="portal-apt-card__service">{serviceName}</strong>
                    <span className="portal-apt-card__pro">{professionalName}</span>
                    {apt.professional?.specialty && (
                        <span className="portal-apt-card__specialty">{apt.professional.specialty}</span>
                    )}
                    {isCancellable && (
                        <CancelAppointmentButton
                            aptId={apt.id}
                            startTime={apt.start_time}
                            serviceName={serviceName}
                            cancellationHours={cancellationHours}
                        />
                    )}
                </div>
                <div className="portal-apt-card__status">
                    <span className={`portal-badge ${STATUS_CLASS[apt.status]}`}>
                        {STATUS_LABEL[apt.status]}
                    </span>
                </div>
            </div>
        </li>
    );
}
