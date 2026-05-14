'use client';

import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { addDays, endOfMonth, startOfMonth, subDays } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import type { Appointment, AppointmentStatus, ScheduleException } from '@/lib/types';
import {
    useCancelCita,
    useCitas,
    useCreateCita,
    useCreateException,
    useScheduleExceptions,
    useUpdateCita,
    useUpdateCitaStatus,
} from '@/hooks/useCitas';
import { useProfesionales } from '@/hooks/useProfesionales';
import { useServicios } from '@/hooks/useServicios';
import { useSettings } from '@/hooks/useSettings';
import { AppointmentDetailPanel } from './components/AppointmentDetailPanel';
import { AppointmentExceptionModal, type ExceptionFormData } from './components/AppointmentExceptionModal';
import { AppointmentFormModal, type AppointmentFormData } from './components/AppointmentFormModal';
import { CancelCitaModal } from './components/CancelCitaModal';
import { RescheduleModal } from './components/RescheduleModal';
import { CitasTimeline } from './components/CitasTimeline';
import { CitasFilters } from './components/CitasFilters';
import { CitasHeader } from './components/CitasHeader';
import { CitasTable } from './components/CitasTable';
import Icon from '@/components/Icon';
import { CalendarSidebar } from './components/CalendarSidebar';

const CLINIC_TIME_ZONE = 'Europe/Madrid';

function hasProfessionalOverlap(
    appointments: Appointment[],
    payload: {
        professionalId: string | null;
        start: Date;
        end: Date;
        excludeId?: string;
    }
): boolean {
    if (!payload.professionalId) return false;

    const nextStart = payload.start.getTime();
    const nextEnd = payload.end.getTime();

    return appointments.some((apt) => {
        if (apt.id === payload.excludeId) return false;
        if (apt.status === 'cancelled') return false;
        if (apt.professional_id !== payload.professionalId) return false;

        const currentStart = new Date(apt.start_time).getTime();
        const currentEnd = new Date(apt.end_time).getTime();

        return nextStart < currentEnd && nextEnd > currentStart;
    });
}

export default function CitasPage() {
    const { profile } = useAuth();
    const { data: settings } = useSettings();

    const openHour = settings?.opening_hour ? parseInt(settings.opening_hour.split(':')[0], 10) : 7;
    const closeHour = settings?.closing_hour ? parseInt(settings.closing_hour.split(':')[0], 10) : 20;

    const [mainPageViewMode, setMainPageViewMode] = useState<'list' | 'calendar'>('calendar');
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const [showNewModal, setShowNewModal] = useState(false);
    const [showExceptionModal, setShowExceptionModal] = useState(false);
    const [initialTimeForm, setInitialTimeForm] = useState('09:00');
    const [initialProfessionalId, setInitialProfessionalId] = useState<string | null>(null);

    const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
    const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
    const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);

    const isProfessional = profile?.role === 'professional';
    const profId = isProfessional ? (profile?.professional_id ?? undefined) : undefined;

    const rangeStart = useMemo(() => subDays(startOfMonth(selectedDate), 7).toISOString(), [selectedDate]);
    const rangeEnd = useMemo(() => addDays(endOfMonth(selectedDate), 7).toISOString(), [selectedDate]);

    const {
        data: appointments = [],
        isLoading: loadingApts,
        isError: errorApts,
        refetch: refetchAppointments,
    } = useCitas(rangeStart, rangeEnd);

    const calendarAppointments = useMemo(() => {
        if (!profId) return appointments;
        return appointments.filter((apt) => apt.professional_id === profId);
    }, [appointments, profId]);

    const { data: exceptions = [] } = useScheduleExceptions({
        startDate: rangeStart.split('T')[0],
        endDate: rangeEnd.split('T')[0],
        professionalId: profId,
    });

    const { data: services = [] } = useServicios();
    const { data: professionals = [] } = useProfesionales();

    const createCita = useCreateCita();
    const updateCita = useUpdateCita();
    const updateStatus = useUpdateCitaStatus();

    const cancelCita = useCancelCita();
    const createException = useCreateException();

    const filteredAppointments = useMemo(() => {
        return appointments
            .filter((apt) => {
                if (profId && apt.professional_id !== profId) return false;

                if (filter !== 'all') {
                    if (filter === 'upcoming') {
                        if (apt.status === 'cancelled' || apt.status === 'completed') return false;
                    } else if (apt.status !== filter) {
                        return false;
                    }
                }

                if (dateFilter && !apt.start_time.startsWith(dateFilter)) {
                    return false;
                }

                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    const matchName = apt.patient_name?.toLowerCase().includes(term);
                    const patientDocId = apt.patient?.document_id || '';
                    const matchDoc = patientDocId.toLowerCase().includes(term);
                    if (!matchName && !matchDoc) return false;
                }

                return true;
            })
            .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }, [appointments, dateFilter, filter, profId, searchTerm]);

    const handleSlotClick = (date: Date, professionalId: string | null) => {
        const slotDate = DateTime.fromJSDate(date, { zone: CLINIC_TIME_ZONE });
        setSelectedDate(date);
        setInitialTimeForm(slotDate.toFormat('HH:mm'));
        setInitialProfessionalId(professionalId);
        setShowNewModal(true);
    };

    const handleCreateAppointment = async (form: AppointmentFormData, selectedPatientId: string | null) => {
        const service = services.find((s) => s.id === form.service_id);
        const baseDate = form.date;

        if (!baseDate) {
            toast.error('No se pudo interpretar la fecha de la cita');
            throw new Error('INVALID_DATE');
        }

        const startDateTime = DateTime.fromISO(`${baseDate}T${form.time}`, { zone: CLINIC_TIME_ZONE });
        if (!startDateTime.isValid) {
            toast.error('La hora seleccionada no es valida');
            throw new Error('INVALID_TIME');
        }

        const endDateTime = startDateTime.plus({ minutes: service?.duration_minutes || 60 });
        const dateOnly = startDateTime.toISODate();
        const effectiveProfessionalId =
            (isProfessional ? (profile?.professional_id ?? null) : null) ||
            form.professional_id ||
            initialProfessionalId ||
            null;

        if (effectiveProfessionalId && dateOnly) {
            const dayExceptions = (exceptions as ScheduleException[]).filter(
                (ex) => ex.professional_id === effectiveProfessionalId && ex.exception_date === dateOnly
            );

            for (const ex of dayExceptions) {
                if (ex.is_available) continue;

                if (!ex.start_time || !ex.end_time) {
                    toast.warning(`El profesional no esta disponible este dia${ex.reason ? `: ${ex.reason}` : ''}`);
                    throw new Error('NOT_AVAILABLE');
                }

                const exStart = DateTime.fromISO(`${dateOnly}T${ex.start_time}`, { zone: CLINIC_TIME_ZONE });
                const exEnd = DateTime.fromISO(`${dateOnly}T${ex.end_time}`, { zone: CLINIC_TIME_ZONE });
                const overlapsException = startDateTime < exEnd && endDateTime > exStart;

                if (overlapsException) {
                    toast.warning(`El profesional no esta disponible en este horario${ex.reason ? `: ${ex.reason}` : ''}`);
                    throw new Error('NOT_AVAILABLE');
                }
            }

            const overlapsAppointment = hasProfessionalOverlap(calendarAppointments, {
                professionalId: effectiveProfessionalId,
                start: startDateTime.toJSDate(),
                end: endDateTime.toJSDate(),
            });

            if (overlapsAppointment) {
                toast.warning('No se permite solapar citas del mismo profesional');
                throw new Error('OVERLAP');
            }
        }

        try {
            const startIso = startDateTime.toUTC().toISO();
            const endIso = endDateTime.toUTC().toISO();

            if (!startIso || !endIso) {
                throw new Error('INVALID_TIME');
            }

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
                status: 'confirmed',
            });

            setShowNewModal(false);
            setInitialProfessionalId(null);
            toast.success('Cita creada correctamente');
        } catch (error) {
            if (error instanceof Error && (error.message === 'NOT_AVAILABLE' || error.message === 'OVERLAP')) {
                throw error;
            }
            toast.error('Error al crear la cita');
            throw error;
        }
    };

    const handleCreateException = async (form: ExceptionFormData) => {
        try {
            await createException.mutateAsync({
                professional_id: form.professional_id,
                exception_date: form.exception_date,
                is_available: false,
                start_time: form.start_time || null,
                end_time: form.end_time || null,
                reason: form.reason || 'No disponible',
            });
            setShowExceptionModal(false);
            toast.success('Horario bloqueado correctamente');
        } catch (error) {
            toast.error('Error al bloquear el horario');
            throw error;
        }
    };

    const handleConfirmCancel = async (reason: string) => {
        if (!cancelTarget) return;

        try {
            await cancelCita.mutateAsync({ id: cancelTarget.id, reason: reason || null });
            toast.success('Cita cancelada correctamente');
            setCancelTarget(null);
            setSelectedEvent(null);
        } catch {
            toast.error('Error al cancelar la cita');
        }
    };

    const handleReschedule = async (id: string, newStart: Date, newEnd: Date) => {
        const apt = calendarAppointments.find(a => a.id === id);
        if (!apt) return;

        const startIso = newStart.toISOString();
        const endIso   = newEnd.toISOString();

        const overlaps = hasProfessionalOverlap(calendarAppointments, {
            professionalId: apt.professional_id ?? null,
            start: newStart,
            end: newEnd,
            excludeId: id,
        });

        if (overlaps) {
            toast.warning('No se permite solapar citas del mismo profesional');
            return;
        }

        try {
            const updated = await updateCita.mutateAsync({ id, start_time: startIso, end_time: endIso });
            setSelectedEvent(prev => prev?.id === id ? updated : prev);
            toast.success('Cita reprogramada');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error al reprogramar la cita';
            toast.error(msg);
            throw err;
        }
    };

    const handleRetryLoad = () => {
        void refetchAppointments();
    };

    const handleUpdateFromDetail = async (id: string, status: string) => {
        try {
            const nextStatus = status as AppointmentStatus;
            await updateStatus.mutateAsync({ id, status: nextStatus });
            setSelectedEvent((prev) => (prev ? { ...prev, status: nextStatus } : null));
            toast.success('Estado actualizado');
        } catch {
            toast.error('Error al actualizar estado');
        }
    };

    const handleQuickUpdateStatus = async (id: string, status: AppointmentStatus) => {
        try {
            await updateStatus.mutateAsync({ id, status });
            toast.success(status === 'confirmed' ? 'Cita confirmada' : 'Estado actualizado');
        } catch {
            toast.error('Error al actualizar estado');
        }
    };



    const handleBulkConfirm = async (ids: string[]) => {
        try {
            await Promise.all(ids.map(id => updateStatus.mutateAsync({ id, status: 'confirmed' })));
            toast.success(`${ids.length} cita${ids.length !== 1 ? 's' : ''} confirmada${ids.length !== 1 ? 's' : ''}`);
        } catch {
            toast.error('Error al confirmar citas');
        }
    };

    return (
        <div className={`content-shell citas-shell citas-shell--clean ${mainPageViewMode === 'calendar' ? 'citas-shell--calendar' : ''}`}>
            <CitasHeader
                mainPageViewMode={mainPageViewMode}
                setMainPageViewMode={setMainPageViewMode}
                onToday={() => setSelectedDate(new Date())}
                onBlockSchedule={() => setShowExceptionModal(true)}
                onNewAppointment={() => {
                    setInitialTimeForm('09:00');
                    setInitialProfessionalId(isProfessional ? (profile?.professional_id ?? null) : null);
                    setShowNewModal(true);
                }}
            />

            {mainPageViewMode === 'calendar' ? (
                <div className={`citas-stage flex-1 flex gap-5 min-h-0 ${selectedEvent ? 'zc-layout--detail' : ''} transition-all duration-300`}>
                    {/* ── Mini-calendar sidebar ── */}
                    <CalendarSidebar
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                        appointments={calendarAppointments}
                    />

                    <div className="citas-stage__main flex-1 min-h-0 flex flex-col min-w-0">
                        {loadingApts ? (
                            <div className="zc-skeleton-timeline">
                                <div className="zc-skeleton-timeline__header">
                                    <div className="zc-skel zc-skel--title" />
                                    <div className="zc-skel zc-skel--pill" />
                                </div>
                                <div className="zc-skeleton-timeline__strip">
                                    {[...Array(7)].map((_, i) => <div key={i} className="zc-skel zc-skel--strip-day" />)}
                                </div>
                                <div className="zc-skeleton-timeline__events">
                                    {[...Array(4)].map((_, i) => (
                                        <div key={i} className="zc-skel-event" style={{ top: `${i * 90 + 40}px`, height: `${60 + (i % 2) * 20}px`, width: `${55 + (i % 3) * 15}%`, left: `${(i % 2) * 8}%` }} />
                                    ))}
                                </div>
                            </div>
                        ) : errorApts ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-4 p-8 text-center bg-transparent">
                                <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-2 shadow-sm border border-red-100 dark:border-red-500/20">
                                    <Icon name="alert-circle" size={32} className="text-red-500" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-lg font-medium text-[var(--text-primary)]">No se pudieron cargar las citas</h3>
                                    <p className="text-sm max-w-md mx-auto opacity-80">
                                        Ha ocurrido un problema al cargar la informacion. Revisa tu conexion e intentalo de nuevo.
                                    </p>
                                </div>
                                <button onClick={handleRetryLoad} className="btn btn--secondary mt-2 flex items-center gap-2 mx-auto justify-center">
                                    <Icon name="refresh-cw" size={16} />
                                    <span>Reintentar</span>
                                </button>
                            </div>
                        ) : (
                            <CitasTimeline
                                appointments={calendarAppointments}
                                professionals={professionals}
                                selectedDate={selectedDate}
                                setSelectedDate={setSelectedDate}
                                openHour={openHour}
                                closeHour={closeHour}
                                onSlotClick={handleSlotClick}
                                onAppointmentClick={setSelectedEvent}
                                onReschedule={!isProfessional ? handleReschedule : undefined}
                                isDraggable={!isProfessional}
                            />
                        )}
                    </div>

                    {selectedEvent && (
                        <AppointmentDetailPanel
                            variant="inline"
                            appointment={selectedEvent}
                            onClose={() => setSelectedEvent(null)}
                            onUpdateStatus={handleUpdateFromDetail}
                            onInitiateCancel={(apt) => setCancelTarget(apt)}
                            onInitiateReschedule={!isProfessional ? (apt) => setRescheduleTarget(apt) : undefined}
                        />
                    )}
                </div>
            ) : (
                <div className="animate-in fade-in duration-300">
                    <CitasFilters
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        filter={filter}
                        onFilterChange={setFilter}
                        dateFilter={dateFilter}
                        onDateFilterChange={setDateFilter}
                        totalCount={filteredAppointments.length}
                    />

                    {loadingApts ? (
                        <div className="zc-skeleton-list">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="zc-skel-list-item">
                                    <div className="zc-skel zc-skel--avatar" />
                                    <div className="zc-skel-list-item__body">
                                        <div className="zc-skel zc-skel--line" style={{ width: '55%' }} />
                                        <div className="zc-skel zc-skel--line" style={{ width: '35%', marginTop: '6px' }} />
                                    </div>
                                    <div className="zc-skel zc-skel--pill" />
                                </div>
                            ))}
                        </div>
                    ) : errorApts ? (
                        <div className="text-center p-16 text-[var(--text-secondary)] flex flex-col items-center gap-4 border border-[var(--border-color)] bg-[var(--bg-surface)] rounded-xl mt-4 shadow-sm">
                            <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-2 shadow-sm border border-red-100 dark:border-red-500/20">
                                <Icon name="alert-circle" size={32} className="text-red-500" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="text-lg font-medium text-[var(--text-primary)]">No se pudieron cargar las citas</h3>
                                <p className="text-sm max-w-md mx-auto opacity-80">
                                    Ha ocurrido un problema al cargar la informacion. Revisa tu conexion e intentalo de nuevo.
                                </p>
                            </div>
                            <button onClick={handleRetryLoad} className="btn btn--secondary mt-2 flex items-center gap-2 mx-auto justify-center">
                                <Icon name="refresh-cw" size={16} />
                                <span>Reintentar</span>
                            </button>
                        </div>
                    ) : (
                        <CitasTable
                            appointments={filteredAppointments}
                            onViewAppointment={setSelectedEvent}
                            onBulkConfirm={!isProfessional ? handleBulkConfirm : undefined}
                            onQuickStatus={handleQuickUpdateStatus}
                        />
                    )}
                </div>
            )}

            {mainPageViewMode === 'list' && (
                <AppointmentDetailPanel
                    variant="overlay"
                    appointment={selectedEvent}
                    onClose={() => setSelectedEvent(null)}
                    onUpdateStatus={handleUpdateFromDetail}
                    onInitiateCancel={(apt) => setCancelTarget(apt)}
                    onInitiateReschedule={!isProfessional ? (apt) => setRescheduleTarget(apt) : undefined}
                />
            )}

            <AppointmentFormModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                selectedDate={selectedDate}
                initialTime={initialTimeForm}
                initialProfessionalId={initialProfessionalId}
                services={services}
                professionals={professionals}
                currentProfessionalId={profile?.professional_id ?? null}
                currentUserRole={profile?.role}
                onSubmit={handleCreateAppointment}
            />

            <AppointmentExceptionModal
                isOpen={showExceptionModal}
                onClose={() => setShowExceptionModal(false)}
                selectedDate={selectedDate}
                professionals={professionals}
                onSubmit={handleCreateException}
            />

            <CancelCitaModal
                isOpen={!!cancelTarget}
                appointment={cancelTarget}
                isLoading={cancelCita.isPending}
                onClose={() => setCancelTarget(null)}
                onConfirm={handleConfirmCancel}
            />

            <RescheduleModal
                isOpen={!!rescheduleTarget}
                appointment={rescheduleTarget}
                isLoading={updateCita.isPending}
                onClose={() => setRescheduleTarget(null)}
                onSubmit={handleReschedule}
            />
        </div>
    );
}
