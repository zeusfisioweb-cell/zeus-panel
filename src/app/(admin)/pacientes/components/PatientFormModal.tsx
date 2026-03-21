'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Patient } from '@/lib/types';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const phoneRegex = /^(?:\+34|0034|34)?[ -]*(?:6|7)[ -]*([0-9][ -]*){8}$/i;

export const patientFormSchema = z.object({
    first_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    last_name: z.string().min(2, "Los apellidos deben tener al menos 2 caracteres"),
    document_id: z.string().optional().or(z.literal('')),
    phone: z.string().regex(phoneRegex, "Formato de número telefónico válido en España requerido").optional().or(z.literal('')),
    email: z.string().email("Correo electrónico válido requerido").optional().or(z.literal('')),
    birth_date: z.string().optional().or(z.literal('')),
    address: z.string().optional().or(z.literal('')),
    gdpr_consent: z.boolean(),
    marketing_consent: z.boolean(),
}).refine(data => data.email || data.phone, {
    message: "Debe proporcionar al menos un correo o número de teléfono",
    path: ["email"],
});

export type PatientFormData = z.infer<typeof patientFormSchema>;

interface PatientFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editing: Patient | null;
    onSubmit: (data: PatientFormData) => Promise<void>;
}

export function PatientFormModal({ isOpen, onClose, editing, onSubmit }: PatientFormModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit: hookFormSubmit, reset, setFocus, formState: { errors } } = useForm<PatientFormData>({
        resolver: zodResolver(patientFormSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            document_id: '',
            phone: '',
            email: '',
            birth_date: '',
            address: '',
            gdpr_consent: false,
            marketing_consent: false,
        }
    });

    useEffect(() => {
        if (isOpen) {
            if (editing) {
                reset({
                    first_name: editing.first_name,
                    last_name: editing.last_name,
                    document_id: editing.document_id || '',
                    phone: editing.phone || '',
                    email: editing.email || '',
                    birth_date: editing.birth_date || '',
                    address: editing.address || '',
                    gdpr_consent: editing.gdpr_consent,
                    marketing_consent: editing.marketing_consent,
                });
            } else {
                reset({
                    first_name: '',
                    last_name: '',
                    document_id: '',
                    phone: '',
                    email: '',
                    birth_date: '',
                    address: '',
                    gdpr_consent: false,
                    marketing_consent: false,
                });
            }
            setTimeout(() => {
                setFocus('first_name');
            }, 50);
        }
    }, [isOpen, editing, reset, setFocus]);

    const onValidSubmit = async (data: PatientFormData) => {
        setIsSubmitting(true);
        try {
            await onSubmit(data);
            onClose();
        } catch (error) {
            // Error managed by parent
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editing ? 'Editar Paciente' : 'Añadir Nuevo Paciente'}
            maxWidth="2xl"
        >
            <form onSubmit={hookFormSubmit(onValidSubmit, (err) => { toast.error('Por favor, revisa los errores en el formulario'); })} className="flex flex-col h-full max-h-[80vh]">
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Input
                                label="Nombre"
                                required
                                {...register('first_name')}
                                placeholder="Ej: Ana"
                            />
                            {errors.first_name && <span className="text-red-500 text-xs mt-1 block">{errors.first_name.message as string}</span>}
                        </div>
                        <div>
                            <Input
                                label="Apellidos"
                                required
                                {...register('last_name')}
                                placeholder="Ej: García López"
                            />
                            {errors.last_name && <span className="text-red-500 text-xs mt-1 block">{errors.last_name.message as string}</span>}
                        </div>
                        <div>
                            <Input
                                label="DNI / NIE"
                                {...register('document_id')}
                                placeholder="12345678A"
                            />
                            {errors.document_id && <span className="text-red-500 text-xs mt-1 block">{errors.document_id.message as string}</span>}
                        </div>
                        <div>
                            <Input
                                label="Teléfono"
                                {...register('phone')}
                                placeholder="+34 600 000 000"
                            />
                            {errors.phone && <span className="text-red-500 text-xs mt-1 block">{errors.phone.message as string}</span>}
                        </div>
                        <div>
                            <Input
                                label="Email"
                                type="email"
                                {...register('email')}
                                placeholder="ana@ejemplo.com"
                            />
                            {errors.email && <span className="text-red-500 text-xs mt-1 block">{errors.email.message as string}</span>}
                        </div>
                        <div>
                            <Input
                                label="Fecha de nacimiento"
                                type="date"
                                {...register('birth_date')}
                            />
                            {errors.birth_date && <span className="text-red-500 text-xs mt-1 block">{errors.birth_date.message as string}</span>}
                        </div>
                    </div>

                    <div className="pt-2">
                        <div>
                            <Input
                                label="Dirección"
                                {...register('address')}
                                placeholder="Calle, número, piso, ciudad..."
                            />
                        </div>
                    </div>

                    <div className="pt-4 space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                {...register('gdpr_consent')}
                                className="mt-1 w-4 h-4 text-[var(--brand-main)] rounded border-gray-300 focus:ring-[var(--brand-main)]"
                            />
                            <span className="text-sm text-[var(--text-main)]">El paciente ha aceptado la política de privacidad (RGPD)</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                {...register('marketing_consent')}
                                className="mt-1 w-4 h-4 text-[var(--brand-main)] rounded border-gray-300 focus:ring-[var(--brand-main)]"
                            />
                            <span className="text-sm text-[var(--text-main)]">Acepta recibir comunicaciones comerciales y recordatorios</span>
                        </label>
                    </div>
                </div>

                <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 flex justify-end gap-3 rounded-b-xl">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={isSubmitting} isLoading={isSubmitting}>
                        {editing ? 'Guardar cambios' : 'Guardar paciente'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
