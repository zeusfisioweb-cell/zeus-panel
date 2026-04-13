'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateTime } from 'luxon';
import { useAuth } from '@/lib/auth-context';

import type {
    Appointment,
    AppointmentStatus,
    DashboardData,
    DashboardGlobalStats,
    DashboardStatsSummary,
} from '@/lib/types';
import { DashboardStats } from './components/DashboardStats';
import { DashboardCharts } from './components/DashboardCharts';
import { DashboardAgenda } from './components/DashboardAgenda';
import { AppointmentFormModal, AppointmentFormData } from './citas/components/AppointmentFormModal';
import { useCreateCita, useCitas, useUpdateCitaStatus } from '@/hooks/useCitas';
import { getDashboardData } from './actions';

const CLINIC_TIME_ZONE = 'Europe/Madrid';

/** Checks if a new appointment would overlap with any existing non-cancelled appointment for the same professional. */
function hasProfessionalOverlap(
    appointments: Appointment[],
    payload: { professionalId: string | null; start: Date; end: Date; }
): boolean {
    if (!payload.professionalId) return false;
    const nextStart = payload.start.getTime();
    const nextEnd = payload.end.getTime();
    return appointments.some((apt) => {
        if (apt.status === 'cancelled') return false;
        if (apt.professional_id !== payload.professionalId) return false;
        const curStart = new Date(apt.start_time).getTime();
        const curEnd = new Date(apt.end_time).getTime();
        return nextStart < curEnd && nextEnd > curStart;
    });
}

export default function DashboardPage() {
    const [supabase] = useState(() => createClient());
    const queryClient = useQueryClient();
    const { profile } = useAuth();

    const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const updateDashboardDate = (nextDate: Date) => {
        setSelectedDate(nextDate);
        setDateRange({ start: nextDate, end: nextDate });
    };

    const { data: dashboardData, isLoading: loading } = useQuery<DashboardData | null>({
        queryKey: ['dashboard', dateRange.start.toISOString(), dateRange.end.toISOString(), profile?.id, profile?.role],
        queryFn: async () => {
            const todayStr = format(dateRange.start, 'yyyy-MM-dd');
            const endStr = format(dateRange.end, 'yyyy-MM-dd');
            const startDay = dateRange.start.getDay();
            const weekStart = new Date(dateRange.start);
            weekStart.setDate(dateRange.start.getDate() - (startDay === 0 ? 6 : startDay - 1));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);

            if (!profile) return null;

            return await getDashboardData(
                todayStr,
                endStr,
                weekStart.toISOString(),
                weekEnd.toISOString()
            );
        },
        enabled: !!profile,
    });

    const defaultStats: DashboardStatsSummary = {
        todayCount: 0,
        weekCount: 0,
        totalPatients: 0,
        pendingCount: 0,
    };
    const defaultGlobalStats: DashboardGlobalStats = {
        estimatedRevenue: 0,
        totalGlobalAppointments: 0,
        sessionBreakdown: [],
        globalStatus: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
    };

    const {
        todayAppointments = [],
        stats = defaultStats,
        globalStats = defaultGlobalStats,
        services = [],
        professionals = [],
    } = dashboardData ?? {};

    const createCita = useCreateCita();
    const updateCitaStatus = useUpdateCitaStatus();

    // Load today's appointments for overlap validation on dashboard quick-create
    const todayIso = DateTime.now().setZone(CLINIC_TIME_ZONE).startOf('day').toISO() ?? '';
    const tomorrowIso = DateTime.now().setZone(CLINIC_TIME_ZONE).startOf('day').plus({ days: 1 }).toISO() ?? '';
    const { data: todayAllAppointments = [] } = useCitas(todayIso, tomorrowIso);

    useEffect(() => {
        const channel = supabase
            .channel('dashboard-appointments')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'appointments' },
                () => {
                    toast.success('Nueva cita recibida', {
                        description: 'Se acaba de reservar una nueva cita.',
                        icon: '',
                        duration: 5000,
                    });
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'appointments' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'appointments' },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient, supabase]);

    const handleUpdateStatus = async (id: string, status: AppointmentStatus) => {
        try {
            await updateCitaStatus.mutateAsync({ id, status });
            toast.success('Estado actualizado');
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch {
            toast.error('Error al actualizar');
        }
    };

    const handleCreateAppointment = async (form: AppointmentFormData, selectedPatientId: string | null) => {
        const service = services.find((s) => s.id === form.service_id);

        // Use Luxon with clinic timezone — matches citas/page.tsx behaviour
        const selectedDay = DateTime.fromJSDate(selectedDate, { zone: CLINIC_TIME_ZONE });
        const baseDate = selectedDay.toISODate();

        if (!baseDate) {
            toast.error('No se pudo interpretar la fecha de la cita');
            return;
        }

        const startDateTime = DateTime.fromISO(`${baseDate}T${form.time}`, { zone: CLINIC_TIME_ZONE });
        if (!startDateTime.isValid) {
            toast.error('La hora seleccionada no es válida');
            return;
        }

        const endDateTime = startDateTime.plus({ minutes: service?.duration_minutes || 60 });

        const effectiveProfessionalId =
            profile?.role === 'professional' ? profile?.id : (form.professional_id || null);

        // Overlap guard — same logic as citas/page.tsx
        if (effectiveProfessionalId) {
            const overlaps = hasProfessionalOverlap(todayAllAppointments, {
                professionalId: effectiveProfessionalId,
                start: startDateTime.toJSDate(),
                end: endDateTime.toJSDate(),
            });
            if (overlaps) {
                toast.warning('No se permite solapar citas del mismo profesional');
                return;
            }
        }

        const startIso = startDateTime.toUTC().toISO();
        const endIso = endDateTime.toUTC().toISO();

        if (!startIso || !endIso) {
            toast.error('Error al calcular la hora de la cita');
            return;
        }

        try {
            await createCita.mutateAsync({
                patient_name: form.patient_name,
                patient_phone: form.patient_phone || null,
                patient_email: form.patient_email || null,
                patient_id: selectedPatientId,
                service_id: form.service_id,
                professional_id: effectiveProfessionalId,
                start_time: startIso,
                end_time: endIso,
                notes: form.notes || null,
                source: 'admin',
            });

            setShowNewModal(false);
            toast.success('Cita creada correctamente');
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch {
            toast.error('Error al crear la cita');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="spinner" />
            </div>
        );
    }

    const now = new Date();
    const isTodaySelected = dateRange.start.toDateString() === now.toDateString();
    const actionableAppointments = todayAppointments
        .filter((apt) => apt.status === 'pending' || apt.status === 'confirmed')
        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const upcomingBase = isTodaySelected
        ? actionableAppointments.filter((apt) => new Date(apt.end_time).getTime() >= now.getTime())
        : actionableAppointments;
    const agendaAppointments = (upcomingBase.length > 0 ? upcomingBase : actionableAppointments).slice(0, 6);

    const pieColors = ['#AD7332', '#C9954D', '#2563EB', '#059669', '#D97706', '#0F766E', '#8B5A26', '#64748B'];
    const sessionBreakdown = globalStats.sessionBreakdown.map((item, index) => ({
        name: item.name,
        value: item.value,
        color: pieColors[index % pieColors.length],
    }));

    const statusMeta = [
        { key: 'pending', label: 'Pendientes', color: '#D97706' },
        { key: 'confirmed', label: 'Confirmadas', color: '#059669' },
        { key: 'completed', label: 'Finalizadas', color: '#2563EB' },
        { key: 'cancelled', label: 'Canceladas', color: '#DC2626' },
    ] as const;

    const statusBreakdown = statusMeta.map((status) => ({
        key: status.key,
        name: status.label,
        color: status.color,
        value: globalStats.globalStatus[status.key as keyof typeof globalStats.globalStatus] || 0,
    }));

    const selectedDateLabel = format(dateRange.start, "EEEE, d 'de' MMMM", { locale: es });
    const selectedDateShort = format(dateRange.start, 'dd MMM yyyy', { locale: es });

    return (
        <div className="content-shell summary-v5 animate-in fade-in duration-300">
            <header className="summary-v5__header">
                <div className="summary-v5__header-main">
                    <p className="summary-v5__eyebrow">Zeus Fisioterapia</p>
                    <h1 className="summary-v5__title">Resumen del centro</h1>
                    <p className="summary-v5__subtitle">
                        {selectedDateLabel} | {profile?.full_name || 'Usuario'}
                    </p>
                </div>

                <div className="summary-v5__header-side">
                    <div className="summary-v5__header-day" aria-label="Fecha seleccionada">
                        <span>Fecha</span>
                        <strong>{selectedDateShort}</strong>
                    </div>

                    <div className="summary-v5__header-tools">
                        <div className="summary-v5__date-nav">
                            <button
                                className="btn btn--ghost"
                                type="button"
                                onClick={() => {
                                    updateDashboardDate(subDays(dateRange.start, 1));
                                }}
                                title="Dia anterior"
                                aria-label="Ir al dia anterior"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                            </button>

                            <span className="summary-v5__date-value" aria-live="polite">
                                {selectedDateShort}
                            </span>

                            <button
                                className="btn btn--ghost"
                                type="button"
                                onClick={() => {
                                    updateDashboardDate(addDays(dateRange.start, 1));
                                }}
                                title="Dia siguiente"
                                aria-label="Ir al dia siguiente"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                            </button>

                            {dateRange.start.toDateString() !== new Date().toDateString() && (
                                <button
                                    className="btn btn--ghost"
                                    type="button"
                                    onClick={() => {
                                        updateDashboardDate(new Date());
                                    }}
                                    aria-label="Volver a hoy"
                                >
                                    Hoy
                                </button>
                            )}
                        </div>

                        <div className="summary-v5__header-actions">
                            <button className="btn btn--primary" type="button" onClick={() => setShowNewModal(true)} aria-label="Crear nueva cita">
                                Nueva cita
                            </button>
                            <Link href="/citas" className="btn btn--secondary" aria-label="Abrir agenda completa">
                                Abrir agenda
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            <section className="summary-v5__overview">
                <DashboardStats stats={stats} globalStats={globalStats} todayAppointments={todayAppointments} />
            </section>

            <div className="summary-v5__grid">
                <main className="summary-v5__main">
                    <DashboardAgenda
                        todayAppointments={agendaAppointments}
                        totalActionableCount={actionableAppointments.length}
                        onNewAppointmentClick={() => setShowNewModal(true)}
                        onUpdateStatus={handleUpdateStatus}
                    />
                </main>

                <aside className="summary-v5__aside">
                    <DashboardCharts
                        sessionBreakdown={sessionBreakdown}
                        statusBreakdown={statusBreakdown}
                        pendingCount={stats.pendingCount}
                        totalActionableCount={actionableAppointments.length}
                        globalTotalSessions={globalStats.totalGlobalAppointments}
                    />
                </aside>
            </div>

            <AppointmentFormModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                selectedDate={selectedDate}
                initialTime={'09:00'}
                services={services}
                professionals={professionals}
                currentUserId={profile?.id}
                currentUserRole={profile?.role}
                onSubmit={handleCreateAppointment}
            />
        </div>
    );
}
