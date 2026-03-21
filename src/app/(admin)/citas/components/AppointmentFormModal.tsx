'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Icon from '@/components/Icon';
import { getAvatarColor, getInitials } from '@/lib/utils';
import type { Professional, Service } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import type { AppointmentStatus } from '@/lib/types';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export const appointmentSchema = z.object({
    patient_name: z.string().min(2, 'El nombre completo es requerido'),
    patient_phone: z.string().optional(),
    patient_email: z.string().email('Email invalido').or(z.literal('')),
    patient_dni: z.string().min(5, 'DNI/NIE es requerido'),
    service_id: z.string().min(1, 'Debe seleccionar un servicio'),
    professional_id: z.string().optional(),
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
    services: Service[];
    professionals: Professional[];
    currentUserId?: string;
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
    services,
    professionals,
    currentUserId,
    currentUserRole,
    onSubmit,
}: AppointmentFormModalProps) {
    const supabase = createClient();
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            time: '09:00',
            notes: '',
        },
    });

    const [patientSearch, setPatientSearch] = useState('');
    const [patientResults, setPatientResults] = useState<PatientSearchResult[]>([]);
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        reset({
            time: initialTime,
            service_id: services[0]?.id || '',
            professional_id: currentUserRole === 'professional' ? currentUserId || '' : '',
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
            searchInputRef.current?.focus();
        }, 60);

        return () => clearTimeout(timer);
    }, [isOpen, initialTime, services, currentUserId, currentUserRole, reset]);

    const handleSearchPatients = async (query: string) => {
        setPatientSearch(query);

        if (query.length < 2) {
            setPatientResults([]);
            setShowPatientDropdown(false);
            return;
        }

        const { data } = await supabase
            .from('patients')
            .select('id, first_name, last_name, document_id, phone, email')
            .or(`document_id.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
            .limit(5);

        const results = (data || []) as PatientSearchResult[];
        setPatientResults(results);
        setShowPatientDropdown(results.length > 0);
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
        >
            <form onSubmit={hookFormSubmit(onValidSubmit)} className="appointment-form">
                <div className="appointment-form__content">
                    <section className="appointment-form__section">
                        <header className="appointment-form__section-head">
                            <h4>Paciente</h4>
                            <p>Busca uno existente o completa los datos basicos.</p>
                        </header>

                        <div className="appointment-form__field appointment-form__field--search">
                            <label className="appointment-form__label">Buscar paciente</label>
                            <div className="appointment-form__search-wrap">
                                <span className="appointment-form__search-icon">
                                    <Icon name="search" size={16} />
                                </span>
                                <input
                                    ref={searchInputRef}
                                    className="form-input appointment-form__search-input"
                                    value={patientSearch}
                                    onChange={(e) => handleSearchPatients(e.target.value)}
                                    placeholder="DNI o nombre"
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

                        <div className="appointment-form__grid appointment-form__grid--2">
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
                                    label="Telefono"
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

                    <section className="appointment-form__section">
                        <header className="appointment-form__section-head">
                            <h4>Servicio</h4>
                            <p>Selecciona servicio y profesional.</p>
                        </header>

                        <div className="appointment-form__grid appointment-form__grid--2">
                            <div>
                                <label className="appointment-form__label">Servicio *</label>
                                <select className="form-input form-select" {...register('service_id')}>
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
                                <label className="appointment-form__label">Profesional</label>
                                <select
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

                    <section className="appointment-form__section">
                        <header className="appointment-form__section-head">
                            <h4>Horario y notas</h4>
                            <p>
                                {selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' })} | ajusta hora y notas.
                            </p>
                        </header>

                        <div className="appointment-form__grid appointment-form__grid--2">
                            <div>
                                <label className="appointment-form__label">Hora de inicio *</label>
                                <input type="time" className="form-input" {...register('time')} />
                                {errors.time && <span className="appointment-form__error">{errors.time.message}</span>}
                            </div>

                            <div>
                                <label className="appointment-form__label">Notas</label>
                                <input
                                    className="form-input"
                                    {...register('notes')}
                                    placeholder="Observaciones de la cita"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                <div className="appointment-form__footer">
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
