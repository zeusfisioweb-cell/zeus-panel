'use client';

import React, { FormEvent, useEffect, useState, useRef } from 'react';
import { Service, ServiceCategory, Professional } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ServiceSchema, validateData } from '@/lib/schemas';
import { toast } from 'sonner';

interface ServiceFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editing: Service | null;
    categories: ServiceCategory[];
    professionals?: Professional[];
    onSubmit: (data: Omit<Service, 'id' | 'created_at' | 'category' | 'professional_services'> & { professional_ids: string[] }) => Promise<void>;
    onUpdate: (id: string, data: Partial<Service> & { professional_ids: string[] }) => Promise<void>;
}

export function ServiceFormModal({
    isOpen,
    onClose,
    editing,
    categories,
    professionals = [],
    onSubmit,
    onUpdate,
}: ServiceFormModalProps) {
    const [form, setForm] = useState({
        name: '',
        description: '',
        duration_minutes: 50,
        price: 0,
        category_id: '',
        is_active: true,
    });

    const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        if (editing) {
            setForm({
                name: editing.name,
                description: editing.description || '',
                duration_minutes: editing.duration_minutes,
                price: Number(editing.price),
                category_id: editing.category_id || '',
                is_active: editing.is_active,
            });
            setSelectedProfessionalIds(
                (editing.professional_services ?? []).map(ps => ps.professional_id)
            );
        } else {
            setForm({
                name: '',
                description: '',
                duration_minutes: 50,
                price: 0,
                category_id: categories[0]?.id || '',
                is_active: true,
            });
            setSelectedProfessionalIds([]);
        }

        setErrors({});
        setIsSubmitting(false);

        setTimeout(() => {
            firstInputRef.current?.focus();
        }, 60);
    }, [isOpen, editing, categories]);

    function toggleProfessional(id: string) {
        setSelectedProfessionalIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    }

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();

        const validation = validateData(ServiceSchema, form);
        if (!validation.success) {
            setErrors(validation.errors);
            toast.error('Revisa los campos obligatorios');
            return;
        }

        setErrors({});
        setIsSubmitting(true);

        try {
            const base = {
                ...form,
                price: Number(form.price),
                requires_medical_history: editing?.requires_medical_history ?? false,
                professional_ids: selectedProfessionalIds,
            };

            if (editing) {
                await onUpdate(editing.id, base);
            } else {
                await onSubmit(base);
            }

            onClose();
        } finally {
            setIsSubmitting(false);
        }
    }

    const activeProfessionals = professionals.filter(p => p.is_active);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editing ? 'Configurar servicio' : 'Nuevo servicio'}
            maxWidth="md"
        >
            <form onSubmit={handleSubmit} className="service-form">
                <div className="service-form__content">
                    <Input
                        ref={firstInputRef}
                        label="Nombre del servicio"
                        error={errors.name?.[0]}
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        placeholder="Ej: Fisioterapia avanzada"
                        required
                    />

                    <div className="service-form__field">
                        <label className="service-form__label">Descripción</label>
                        <textarea
                            className="form-input service-form__textarea"
                            value={form.description}
                            onChange={(event) => setForm({ ...form, description: event.target.value })}
                            placeholder="Detalles visibles en la web"
                        />
                        {errors.description && <span className="service-form__error">{errors.description[0]}</span>}
                    </div>

                    <div className="service-form__grid service-form__grid--2">
                        <Input
                            type="number"
                            label="Duración (minutos)"
                            error={errors.duration_minutes?.[0]}
                            value={form.duration_minutes}
                            onChange={(event) => setForm({ ...form, duration_minutes: +event.target.value })}
                            required
                        />

                        <Input
                            type="number"
                            step="0.01"
                            label="Precio (EUR)"
                            error={errors.price?.[0]}
                            value={form.price}
                            onChange={(event) => setForm({ ...form, price: +event.target.value })}
                            required
                        />
                    </div>

                    <div className="service-form__grid service-form__grid--2">
                        <div className="service-form__field">
                            <label className="service-form__label">Categoría</label>
                            <select
                                className="form-input form-select"
                                value={form.category_id}
                                onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                                required
                            >
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                            {errors.category_id && <span className="service-form__error">{errors.category_id[0]}</span>}
                        </div>

                        <div className="service-form__field">
                            <label className="service-form__label">Estado</label>
                            <select
                                className="form-input form-select"
                                value={form.is_active ? 'yes' : 'no'}
                                onChange={(event) => setForm({ ...form, is_active: event.target.value === 'yes' })}
                            >
                                <option value="yes">Activo (publico)</option>
                                <option value="no">Suspendido (privado)</option>
                            </select>
                        </div>
                    </div>

                    {activeProfessionals.length > 0 && (
                        <div className="service-form__field">
                            <label className="service-form__label">
                                Profesionales habilitados
                                <span className="service-form__label-hint"> — quiénes imparten este servicio</span>
                            </label>
                            <div className="service-form__prof-list">
                                {activeProfessionals.map(prof => {
                                    const name = prof.profile?.full_name || 'Profesional';
                                    const checked = selectedProfessionalIds.includes(prof.id);
                                    return (
                                        <label key={prof.id} className="service-form__prof-item">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleProfessional(prof.id)}
                                            />
                                            <span
                                                className="service-form__prof-dot"
                                                style={{ background: prof.color_code || '#94a3b8' }}
                                            />
                                            <span>{name}</span>
                                            {prof.specialty && (
                                                <span className="service-form__prof-specialty">{prof.specialty}</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="service-form__footer">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" isLoading={isSubmitting}>
                        {editing ? 'Guardar cambios' : 'Crear servicio'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
