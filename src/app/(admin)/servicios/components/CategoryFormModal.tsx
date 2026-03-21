'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface CategoryFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { name: string; is_active: boolean; display_order: number }) => Promise<void>;
    categoriesCount: number;
}

export function CategoryFormModal({ isOpen, onClose, onSubmit, categoriesCount }: CategoryFormProps) {
    const [form, setForm] = useState({ name: '', is_active: true, display_order: categoriesCount + 1 });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when opened with updated categoriesCount
    useEffect(() => {
        if (isOpen) {
            setForm(prev => ({ ...prev, name: '', is_active: true, display_order: categoriesCount + 1 }));
            setIsSubmitting(false);
        }
    }, [isOpen, categoriesCount]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit(form);
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Nueva Categoría" maxWidth="md">
            <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <Input
                        label="Nombre de la categoría"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Ej: Fisioterapia"
                        required
                    />

                    <div className="flex flex-col gap-1 w-full">
                        <label className="text-sm font-medium text-[var(--text-muted)]">Estado</label>
                        <select
                            className="form-input form-select"
                            value={form.is_active ? 'yes' : 'no'}
                            onChange={(e) => setForm({ ...form, is_active: e.target.value === 'yes' })}
                        >
                            <option value="yes">Activa</option>
                            <option value="no">Inactiva</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-[var(--border-color)]">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="primary" isLoading={isSubmitting}>
                        Crear Categoría
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
