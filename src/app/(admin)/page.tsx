'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/Icon';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/lib/auth-context';

import type { Appointment, Service, Professional, AppointmentStatus } from '@/lib/types';
import { DashboardStats } from './components/DashboardStats';
import { DashboardCharts } from './components/DashboardCharts';
import { DashboardAgenda } from './components/DashboardAgenda';
import { AppointmentFormModal, AppointmentFormData } from './citas/components/AppointmentFormModal';
import { useCreateCita, useUpdateCitaStatus } from '@/hooks/useCitas';
import { getDashboardData } from './actions';

export default function DashboardPage() {
    const [supabase] = useState(() => createClient());
    const queryClient = useQueryClient();
    const { profile } = useAuth();

    const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos dias';
        if (hour < 20) return 'Buenas tardes';
        return 'Buenas noches';
    };

    const { data: dashboardData, isLoading: loading } = useQuery({
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
                weekEnd.toISOString(),
                profile.id,
                profile.role
            );
        },
        enabled: !!profile,
    });

    const {
        todayAppointments = [],
        stats = { todayCount: 0, weekCount: 0, totalPatients: 0, pendingCount: 0 },
        services = [],
        professionals = [],
    } = dashboardData || {};

    const createCita = useCreateCita();
    const updateCitaStatus = useUpdateCitaStatus();

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
        const baseDate = selectedDate.toISOString().split('T')[0];
        const startTime = new Date(`${baseDate}T${form.time}:00`);
        const endTime = new Date(startTime.getTime() + (service?.duration_minutes || 60) * 60000);

        try {
            await createCita.mutateAsync({
                patient_name: form.patient_name,
                patient_phone: form.patient_phone || null,
                patient_email: form.patient_email || null,
                patient_id: selectedPatientId,
                service_id: form.service_id,
                professional_id: profile?.role === 'professional' ? profile?.id : (form.professional_id || null),
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
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

    const sessionTypes = todayAppointments.reduce<Record<string, number>>((acc, apt) => {
        if (apt.status === 'cancelled') return acc;
        const name = apt.service?.name || 'Otro';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});

    const pieColors = ['#ad7332', '#2f6a3e', '#8a5a1f', '#c9954d', '#7a4e1e', '#5d4a35'];
    const sessionBreakdown = Object.entries(sessionTypes)
        .map(([name, value], index) => ({
            name,
            value: value as number,
            color: pieColors[index % pieColors.length],
        }))
        .sort((a, b) => (b.value as number) - (a.value as number));

    return (
        <div className="content-shell dashboard-shell animate-in fade-in duration-300">
            <section className="dashboard-head dashboard-head--compact">
                <div className="dashboard-head__left">
                    <p className="dashboard-head__eyebrow">Panel diario</p>
                    <h1 className="dashboard-head__title dashboard-head__title--compact">
                        {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Admin'}
                    </h1>
                    <div className="dashboard-head__meta">
                        <div className="dashboard-head__date-inline dashboard-head__meta-item">
                            <Icon name="calendar" size={14} />
                            <span>{format(dateRange.start, "EEEE, d 'de' MMMM", { locale: es })}</span>
                        </div>
                        <span className="dashboard-head__meta-separator" aria-hidden="true">|</span>
                        <span className="dashboard-head__meta-item">
                            {stats.todayCount} citas activas
                        </span>
                        <span className="dashboard-head__meta-separator" aria-hidden="true">|</span>
                        <span className="dashboard-head__meta-item">
                            {stats.pendingCount} por confirmar
                        </span>
                    </div>
                </div>

                <div className="dashboard-toolbar">
                    <div className="date-nav">
                        <button
                            className="btn btn--secondary btn--sm"
                            type="button"
                            onClick={() => {
                                const newDate = subDays(dateRange.start, 1);
                                setSelectedDate(newDate);
                                setDateRange({ start: newDate, end: newDate });
                            }}
                            title="Dia anterior"
                            aria-label="Ir al día anterior"
                        >
                            <Icon name="chevron-left" size={16} />
                        </button>

                        <span className="date-nav__value" aria-live="polite">
                            {format(dateRange.start, 'dd MMM yyyy', { locale: es })}
                        </span>

                        <button
                            className="btn btn--secondary btn--sm"
                            type="button"
                            onClick={() => {
                                const newDate = addDays(dateRange.start, 1);
                                setSelectedDate(newDate);
                                setDateRange({ start: newDate, end: newDate });
                            }}
                            title="Dia siguiente"
                            aria-label="Ir al día siguiente"
                        >
                            <Icon name="chevron-right" size={16} />
                        </button>

                        {dateRange.start.toDateString() !== new Date().toDateString() && (
                            <button
                                className="btn btn--ghost btn--sm"
                                type="button"
                                onClick={() => {
                                    const newDate = new Date();
                                    setSelectedDate(newDate);
                                    setDateRange({ start: newDate, end: newDate });
                                }}
                                aria-label="Volver a hoy"
                            >
                                Hoy
                            </button>
                        )}
                    </div>

                    <button className="btn btn--primary dashboard-toolbar__cta" type="button" onClick={() => setShowNewModal(true)} aria-label="Crear nueva cita">
                        <Icon name="plus" size={16} /> Nueva cita
                    </button>
                </div>
            </section>

            <div className="dashboard-layout">
                <div className="dashboard-layout__main">
                    <DashboardStats stats={stats} />
                    <DashboardCharts sessionBreakdown={sessionBreakdown} pendingCount={stats.pendingCount} />
                </div>

                <aside className="dashboard-layout__aside">
                    <DashboardAgenda
                        todayAppointments={todayAppointments}
                        onNewAppointmentClick={() => setShowNewModal(true)}
                        onUpdateStatus={handleUpdateStatus}
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
