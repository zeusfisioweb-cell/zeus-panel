'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Icon from '@/components/Icon';
import type { Professional, Service, ServiceCategory } from '@/lib/types';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export const professionalFormSchema = z.object({
    full_name: z.string().min(3, 'El nombre completo es requerido'),
    email: z.string().email('Correo electronico invalido'),
    specialty: z.string().optional().or(z.literal('')),
    bio: z.string().optional().or(z.literal('')),
    color_code: z.string().min(1),
    is_active: z.boolean(),
    selectedServices: z.array(z.string()).min(1, 'Debe brindar al menos un servicio'),
});

export type ProfessionalFormData = z.infer<typeof professionalFormSchema>;

export interface DaySchedule {
    active: boolean;
    slots: { start: string; end: string }[];
}

export type ScheduleMap = Record<number, DaySchedule>;

interface ProfessionalFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editing: Professional | null;
    services: Service[];
    categories: ServiceCategory[];
    onSubmit: (data: ProfessionalFormData, scheduleMap: ScheduleMap) => Promise<void>;
    onUpdate: (id: string, data: Partial<ProfessionalFormData>, scheduleMap: ScheduleMap) => Promise<void>;
    initialSchedule: ScheduleMap | null;
}

interface ProfessionalServiceLink {
    service_id: string;
}

export function ProfessionalFormModal({
    isOpen,
    onClose,
    editing,
    services,
    categories,
    onSubmit,
    onUpdate,
    initialSchedule,
}: ProfessionalFormModalProps) {
    const [activeTab, setActiveTab] = useState<'profile' | 'schedule'>('profile');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit: hookFormSubmit,
        reset,
        setValue,
        watch,
        setFocus,
        formState: { errors },
    } = useForm<ProfessionalFormData>({
        resolver: zodResolver(professionalFormSchema),
        defaultValues: {
            full_name: '',
            email: '',
            specialty: '',
            bio: '',
            color_code: '#AD7332',
            is_active: true,
            selectedServices: [],
        },
    });

    const selectedServices = watch('selectedServices') || [];
    const [scheduleMap, setScheduleMap] = useState<ScheduleMap>({});

    useEffect(() => {
        if (!isOpen) return;

        if (editing) {
            const serviceLinks = ((editing as unknown as { professional_services?: ProfessionalServiceLink[] }).professional_services || []);
            reset({
                full_name: editing.profile?.full_name || '',
                email: editing.profile?.email || '',
                specialty: editing.specialty || '',
                bio: editing.bio || '',
                color_code: editing.color_code || '#AD7332',
                is_active: editing.is_active,
                selectedServices: serviceLinks.map((item) => item.service_id),
            });
            setActiveTab('profile');
        } else {
            reset({
                full_name: '',
                email: '',
                specialty: '',
                bio: '',
                color_code: '#AD7332',
                is_active: true,
                selectedServices: [],
            });
            setActiveTab('profile');
        }

        if (initialSchedule) {
            setScheduleMap(initialSchedule);
        }

        setTimeout(() => {
            setFocus('full_name');
        }, 60);
    }, [isOpen, editing, initialSchedule, reset, setFocus]);

    const onValidSubmit = async (data: ProfessionalFormData) => {
        setIsSubmitting(true);
        try {
            if (editing) {
                await onUpdate(editing.id, data, scheduleMap);
            } else {
                await onSubmit(data, scheduleMap);
            }
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    function toggleService(serviceId: string) {
        const nextServices = selectedServices.includes(serviceId)
            ? selectedServices.filter((service) => service !== serviceId)
            : [...selectedServices, serviceId];

        setValue('selectedServices', nextServices, { shouldValidate: true });
    }

    const renderProfileTab = () => (
        <div className="pro-form__stack">
            <section className="pro-form__block">
                <header className="pro-form__block-head">
                    <h4>Datos de usuario</h4>
                </header>

                <div className="pro-form__grid pro-form__grid--2">
                    <div>
                        <Input
                            label="Nombre completo"
                            required
                            {...register('full_name')}
                            placeholder="Ej: Dra. Maria Gomez"
                        />
                        {errors.full_name && <span className="pro-form__error">{errors.full_name.message}</span>}
                    </div>

                    <div>
                        <Input
                            label="Correo electronico"
                            type="email"
                            required
                            {...register('email')}
                            placeholder="maria@ejemplo.com"
                            disabled={!!editing}
                        />
                        {errors.email && <span className="pro-form__error">{errors.email.message}</span>}
                    </div>
                </div>
            </section>

            <section className="pro-form__block">
                <header className="pro-form__block-head">
                    <h4>Perfil publico</h4>
                </header>

                <div className="pro-form__grid pro-form__grid--2">
                    <Input
                        label="Especialidad principal"
                        {...register('specialty')}
                        placeholder="Ej: Fisioterapeuta"
                    />

                    <div>
                        <label className="pro-form__label">Color del calendario</label>
                        <input
                            type="color"
                            className="form-input pro-form__color-input"
                            {...register('color_code')}
                        />
                    </div>
                </div>

                <div>
                    <label className="pro-form__label">Ficha biografica</label>
                    <textarea
                        className="form-input pro-form__textarea"
                        {...register('bio')}
                        placeholder="Trayectoria, formacion tecnica..."
                    />
                </div>

                <label className="pro-form__switch">
                    <input
                        type="checkbox"
                        {...register('is_active')}
                    />
                    <span>Profesional activo (disponible para reservas)</span>
                </label>
            </section>

            <section className="pro-form__block">
                <header className="pro-form__block-head">
                    <h4>Servicios habilitados</h4>
                </header>

                <div className="pro-form__services">
                    {categories.map((category) => {
                        const categoryServices = services.filter((service) => service.category_id === category.id);
                        if (categoryServices.length === 0) return null;

                        return (
                            <div key={category.id} className="pro-form__service-group">
                                <h5>{category.name}</h5>
                                <div className="pro-form__service-list">
                                    {categoryServices.map((service) => (
                                        <label key={service.id} className="pro-form__service-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedServices.includes(service.id)}
                                                onChange={() => toggleService(service.id)}
                                            />
                                            <span>{service.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {categories.length === 0 && (
                        <span className="pro-form__empty">No hay servicios definidos.</span>
                    )}
                </div>

                {errors.selectedServices && <span className="pro-form__error">{errors.selectedServices.message}</span>}
            </section>
        </div>
    );

    const renderScheduleTab = () => {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

        return (
            <div className="pro-form__stack">
                <div className="pro-form__hint">
                    Define bloques de disponibilidad. Puedes añadir turnos de mañana y tarde en el mismo día.
                </div>

                <div className="pro-form__schedule-list">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                        const data = scheduleMap[day] || { active: false, slots: [] };

                        return (
                            <div
                                key={day}
                                className={`pro-form__day-card ${data.active ? 'is-active' : ''}`}
                            >
                                <label className="pro-form__day-head">
                                    <input
                                        type="checkbox"
                                        checked={data.active}
                                        onChange={(event) => {
                                            const checked = event.target.checked;
                                            setScheduleMap((prev) => {
                                                const next = { ...prev };
                                                if (!next[day]) next[day] = { active: false, slots: [] };
                                                next[day].active = checked;

                                                if (checked && next[day].slots.length === 0) {
                                                    next[day].slots = [{ start: '09:00', end: '14:00' }];
                                                }
                                                return next;
                                            });
                                        }}
                                    />
                                    <span>{days[day]}</span>
                                </label>

                                {data.active && (
                                    <div className="pro-form__slots">
                                        {data.slots.map((slot, slotIndex) => (
                                            <div key={slotIndex} className="pro-form__slot-row">
                                                <input
                                                    type="time"
                                                    className="form-input pro-form__time"
                                                    value={slot.start}
                                                    onChange={(event) => {
                                                        const value = event.target.value;
                                                        setScheduleMap((prev) => {
                                                            const next = { ...prev };
                                                            next[day].slots[slotIndex].start = value;
                                                            return next;
                                                        });
                                                    }}
                                                />

                                                <span>a</span>

                                                <input
                                                    type="time"
                                                    className="form-input pro-form__time"
                                                    value={slot.end}
                                                    onChange={(event) => {
                                                        const value = event.target.value;
                                                        setScheduleMap((prev) => {
                                                            const next = { ...prev };
                                                            next[day].slots[slotIndex].end = value;
                                                            return next;
                                                        });
                                                    }}
                                                />

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="pro-form__slot-remove"
                                                    onClick={() => {
                                                        setScheduleMap((prev) => {
                                                            const next = { ...prev };
                                                            next[day].slots.splice(slotIndex, 1);
                                                            if (next[day].slots.length === 0) next[day].active = false;
                                                            return next;
                                                        });
                                                    }}
                                                >
                                                    <Icon name="trash" size={13} />
                                                </Button>
                                            </div>
                                        ))}

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="pro-form__slot-add"
                                            onClick={() => {
                                                setScheduleMap((prev) => {
                                                    const next = { ...prev };
                                                    next[day].slots.push({ start: '16:00', end: '19:00' });
                                                    return next;
                                                });
                                            }}
                                            leftIcon={<Icon name="plus" size={12} />}
                                        >
                                            Añadir turno
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editing ? 'Configurar perfil profesional' : 'Nuevo profesional'}
            maxWidth="3xl"
        >
            <form onSubmit={hookFormSubmit(onValidSubmit, () => toast.error('Revisa los campos requeridos'))} className="pro-form">
                {editing && (
                    <div className="pro-form__tabs">
                        <button
                            type="button"
                            onClick={() => setActiveTab('profile')}
                            className={`pro-form__tab ${activeTab === 'profile' ? 'is-active' : ''}`}
                        >
                            <Icon name="user" size={14} /> Perfil y servicios
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('schedule')}
                            className={`pro-form__tab ${activeTab === 'schedule' ? 'is-active' : ''}`}
                        >
                            <Icon name="clock" size={14} /> Horario de trabajo
                        </button>
                    </div>
                )}

                <div className="pro-form__content">
                    {activeTab === 'profile' ? renderProfileTab() : renderScheduleTab()}
                </div>

                <div className="pro-form__footer">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={isSubmitting} isLoading={isSubmitting}>
                        Guardar configuracion
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
