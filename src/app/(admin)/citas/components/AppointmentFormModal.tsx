'use client';

import React, { useState, useEffect, useRef, useId } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Icon from '@/components/Icon';
import { getAvatarColor, getInitials } from '@/lib/utils';
import type { Professional, Service, AppointmentStatus } from '@/lib/types';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export const appointmentSchema = z.object({
    patient_name: z.string().min(2, 'El nombre completo es requerido'),
    patient_phone: z.string().optional(),
    patient_email: z.string().email('Email invalido').or(z.literal('')),
    patient_dni: z.string().optional(),
    service_id: z.string().min(1, 'Debe seleccionar un servicio'),
    professional_id: z.string().optional(),
    date: z.string().min(10, 'La fecha es requerida'),
    time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Hora invalida'),
    notes: z.string().optional(),
    status: z.custom<AppointmentStatus>().optional(),
});

export type AppointmentFormData = z.infer<typeof appointmentSchema>;

interface AppointmentFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    initialTime: string;
    initialProfessionalId?: string | null;
    services: Service[];
    professionals: Professional[];
    currentProfessionalId?: string | null;
    currentUserRole?: string;
    onSubmit: (form: AppointmentFormData, selectedPatientId: string | null) => Promise<void>;
}

interface PatientSearchResult {
    id: string;
    first_name: string;
    last_name: string | null;
    document_id: string | null;
    phone: string | null;
    email: string | null;
}

export function AppointmentFormModal({
    isOpen,
    onClose,
    selectedDate,
    initialTime,
    initialProfessionalId,
    services,
    professionals,
    currentProfessionalId,
    currentUserRole,
    onSubmit,
}: AppointmentFormModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        };
    }, []);

    const {
        register,
        handleSubmit: hookFormSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<AppointmentFormData>({
        resolver: zodResolver(appointmentSchema),
        defaultValues: {
            patient_name: '',
            patient_phone: '',
            patient_email: '',
            patient_dni: '',
            service_id: '',
            professional_id: '',
            date: '',
            time: '09:00',
            notes: '',
        },
    });

    const [patientSearch, setPatientSearch] = useState('');
    const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const patientSearchId = useId();
    const serviceSelectId = useId();
    const professionalSelectId = useId();
    const dateInputId = useId();
    const timeInputId = useId();
    const notesInputId = useId();

    useEffect(() => {
        if (!isOpen) return;

        const tzOffset = selectedDate.getTimezoneOffset() * 60000; // offset in milliseconds
        const localISOTime = (new Date(selectedDate.getTime() - tzOffset)).toISOString().slice(0, -1);
        const yyyyMmDd = localISOTime.split('T')[0];

        reset({
            date: yyyyMmDd,
            time: initialTime,
            service_id: services[0]?.id || '',
            professional_id: currentUserRole === 'professional'
                ? currentProfessionalId || ''
                : initialProfessionalId || '',
            patient_name: '',
            patient_phone: '',
            patient_email: '',
            patient_dni: '',
            notes: '',
        });

        setPatientSearch('');
        setSelectedPatientId(null);
        setShowPatientDropdown(false);

        const timer = setTimeout(() => {
            searchInputRef.current?.focus({ preventScroll: true });
        }, 60);

        return () => clearTimeout(timer);
    }, [isOpen, selectedDate, initialTime, services, currentProfessionalId, currentUserRole, initialProfessionalId, reset]);

    const handleSearchPatients = (query: string) => {
        setPatientSearch(query);

        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        if (query.length < 2) {
            setPatientResults([]);
            setShowPatientDropdown(false);
            return;
        }

        searchTimerRef.current = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ search: query, page: '1', pageSize: '5' });
                const response = await fetch(`/api/admin/patients?${params.toString()}`, {
                    method: 'GET',
                    credentials: 'same-origin',
                });
                if (!response.ok) throw new Error();
                const payload = (await response.json()) as { data: PatientSearchResult[] };
                const results = payload.data ?? [];
                setPatientResults(results);
                setShowPatientDropdown(results.length > 0);
            } catch {
                setPatientResults([]);
                setShowPatientDropdown(false);
            }
        }, 300);
    };

    const handleSelectPatient = (patient: PatientSearchResult) => {
        const fullName = `${patient.first_name} ${patient.last_name || ''}`.trim();

        setValue('patient_name', fullName, { shouldValidate: true });
        setValue('patient_phone', patient.phone || '', { shouldValidate: true });
        setValue('patient_email', patient.email || '', { shouldValidate: true });
        setValue('patient_dni', patient.document_id || '', { shouldValidate: true });

        setSelectedPatientId(patient.id);
        setPatientSearch(`${patient.document_id || ''} | ${fullName}`);
        setShowPatientDropdown(false);
    };

    const onValidSubmit = async (data: AppointmentFormData) => {
        setIsSubmitting(true);
        try {
            await onSubmit(data, selectedPatientId);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Nueva cita"
            maxWidth="2xl"
            bodyClassName="modal__body--appointment"
        >
            <form onSubmit={hookFormSubmit(onValidSubmit)} className="appointment-form">
                <div className="appointment-form__content p-6 px-8">
                    <section className="appointment-form__section border-none bg-transparent p-0 mb-8">
                        <header className="appointment-form__section-head mb-4">
                            <h4 className="text-sm font-extrabold text-[var(--brand-main)] uppercase tracking-[0.05em] !m-0 mb-1">
                                Paciente
                            </h4>
                            <p className="text-[13px] text-[var(--text-muted)] !m-0">
                                Busca uno existente o completa los datos básicos.
                            </p>
                        </header>

                        <div className="appointment-form__field appointment-form__field--search mb-5">
                            <label className="appointment-form__label" htmlFor={patientSearchId}>
                                Buscar paciente
                            </label>
                            <div className="appointment-form__search-wrap">
                                <span className="appointment-form__search-icon">
                                    <Icon name="search" size={16} />
                                </span>
                                <input
                                    id={patientSearchId}
                                    ref={searchInputRef}
                                    className="form-input appointment-form__search-input"
                                    value={patientSearch}
                                    onChange={(e) => handleSearchPatients(e.target.value)}
                                    placeholder="Escribe DNI o nombre..."
                                    autoComplete="off"
                                />
                            </div>

                            {showPatientDropdown && (
                                <div className="appointment-form__search-results">
                                    {patientResults.map((patient) => {
                                        const fullName = `${patient.first_name} ${patient.last_name || ''}`.trim();

                                        return (
                                            <button
                                                key={patient.id}
                                                type="button"
                                                className="appointment-form__result-item"
                                                onClick={() => handleSelectPatient(patient)}
                                            >
                                                <span
                                                    className="appointment-form__result-avatar"
                                                    style={{ background: getAvatarColor(fullName) }}
                                                >
                                                    {getInitials(fullName)}
                                                </span>
                                                <span className="appointment-form__result-info">
                                                    <strong>{fullName}</strong>
                                                    <span>
                                                        {patient.document_id || 'Sin documento'}
                                                        {patient.phone ? ` | ${patient.phone}` : ''}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="appointment-form__grid appointment-form__grid--2 gap-4">
                            <div>
                                <Input
                                    label="DNI/NIE *"
                                    {...register('patient_dni')}
                                    placeholder="12345678A"
                                />
                                {errors.patient_dni && <span className="appointment-form__error">{errors.patient_dni.message}</span>}
                            </div>

                            <div>
                                <Input
                                    label="Nombre y apellidos *"
                                    {...register('patient_name')}
                                    placeholder="Ej: Ana Garcia"
                                />
                                {errors.patient_name && <span className="appointment-form__error">{errors.patient_name.message}</span>}
                            </div>

                            <div>
                                <Input
                                    label="Teléfono"
                                    type="tel"
                                    {...register('patient_phone')}
                                    placeholder="+34 600 000 000"
                                />
                            </div>

                            <div>
                                <Input
                                    label="Email"
                                    type="email"
                                    {...register('patient_email')}
                                    placeholder="ana@ejemplo.com"
                                />
                                {errors.patient_email && <span className="appointment-form__error">{errors.patient_email.message}</span>}
                            </div>
                        </div>
                    </section>

                    <section className="appointment-form__section border-none bg-transparent p-0 mb-8">
                        <header className="appointment-form__section-head mb-4">
                            <h4 className="text-sm font-extrabold text-[var(--brand-main)] uppercase tracking-[0.05em] !m-0 mb-1">
                                Servicio y Profesional
                            </h4>
                        </header>

                        <div className="appointment-form__grid appointment-form__grid--2 gap-4">
                            <div>
                                <label className="appointment-form__label" htmlFor={serviceSelectId}>
                                    Servicio *
                                </label>
                                <select id={serviceSelectId} className="form-input form-select" {...register('service_id')}>
                                    <option value="" disabled>Seleccionar</option>
                                    {services.map((service) => (
                                        <option key={service.id} value={service.id}>
                                            {service.name} | {service.duration_minutes} min
                                        </option>
                                    ))}
                                </select>
                                {errors.service_id && <span className="appointment-form__error">{errors.service_id.message}</span>}
                            </div>

                            <div>
                                <label className="appointment-form__label" htmlFor={professionalSelectId}>
                                    Profesional
                                </label>
                                <select
                                    id={professionalSelectId}
                                    className={`form-input form-select ${currentUserRole === 'professional' ? 'appointment-form__select--locked' : ''}`}
                                    {...register('professional_id')}
                                    disabled={currentUserRole === 'professional'}
                                >
                                    {currentUserRole !== 'professional' && <option value="">Cualquier profesional disponible</option>}
                                    {professionals.map((pro) => (
                                        <option key={pro.id} value={pro.id}>
                                            {pro.profile?.full_name || 'Profesional'}
                                            {pro.specialty ? ` | ${pro.specialty}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="appointment-form__section border-none bg-transparent p-0">
                        <header className="appointment-form__section-head mb-4">
                            <h4 className="text-sm font-extrabold text-[var(--brand-main)] uppercase tracking-[0.05em] !m-0 mb-1">
                                Horario y Notas
                            </h4>
                            <p className="text-[13px] text-[var(--text-muted)] !m-0">
                                {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' })} | ajusta hora y notas.
                            </p>
                        </header>

                        <div className="appointment-form__grid appointment-form__grid--2 gap-4">
                            <div>
                                <label className="appointment-form__label" htmlFor={dateInputId}>
                                    Fecha *
                                </label>
                                <input id={dateInputId} type="date" className="form-input" {...register('date')} />
                                {errors.date && <span className="appointment-form__error">{errors.date.message}</span>}
                            </div>
                            
                            <div>
                                <label className="appointment-form__label" htmlFor={timeInputId}>
                                    Hora de inicio *
                                </label>
                                <input id={timeInputId} type="time" className="form-input" {...register('time')} />
                                {errors.time && <span className="appointment-form__error">{errors.time.message}</span>}
                            </div>

                            <div className="col-span-full">
                                <label className="appointment-form__label" htmlFor={notesInputId}>
                                    Notas
                                </label>
                                <input
                                    id={notesInputId}
                                    className="form-input"
                                    {...register('notes')}
                                    placeholder="Observaciones internas de la cita"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                <div className="modal__footer py-4 px-8">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={isSubmitting} isLoading={isSubmitting} leftIcon={<Icon name="check" size={14} />}>
                        Confirmar cita
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
