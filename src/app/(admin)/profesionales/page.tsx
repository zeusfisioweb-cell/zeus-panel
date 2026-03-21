'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Professional } from '@/lib/types';
import { toDbDayOfWeek, toUiDayOfWeek } from '@/lib/types';
import { useProfesionales, useCreateProfesional, useUpdateProfesional, useDeleteProfesional } from '@/hooks/useProfesionales';
import { useServicios, useCategorias } from '@/hooks/useServicios';

import ConfirmModal from '@/components/ConfirmModal';
import { ProfesionalesHeader } from './components/ProfesionalesHeader';
import { ProfesionalesTable } from './components/ProfesionalesTable';
import { ProfessionalFormModal, ScheduleMap, ProfessionalFormData } from './components/ProfessionalFormModal';

export default function ProfesionalesPage() {
    // Queries
    const { data: professionals = [], isLoading: isLoadingPros, refetch: refetchPros } = useProfesionales();
    const { data: services = [], isLoading: isLoadingServices } = useServicios();
    const { data: categories = [], isLoading: isLoadingCategories } = useCategorias();

    // Mutations
    const createProfesional = useCreateProfesional();
    const updateProfesional = useUpdateProfesional();
    const deleteProfesional = useDeleteProfesional();

    // Local State
    const [showModal, setShowModal] = useState(false);
    const [editingProf, setEditingProf] = useState<Professional | null>(null);
    const [initialSchedule, setInitialSchedule] = useState<ScheduleMap | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const isLoading = isLoadingPros || isLoadingServices || isLoadingCategories;

    const handleOpenNew = () => {
        setEditingProf(null);

        // Define default schedule (0=Lunes..6=Domingo)
        const defaultMap: ScheduleMap = {};
        [0, 1, 2, 3, 4, 5, 6].forEach(day => {
            defaultMap[day] = {
                active: day >= 0 && day <= 4,
                slots: day >= 0 && day <= 4
                    ? [{ start: '09:00', end: '14:00' }, { start: '16:00', end: '19:00' }]
                    : []
            };
        });

        setInitialSchedule(defaultMap);
        setShowModal(true);
    };

    const handleOpenEdit = async (prof: Professional) => {
        setEditingProf(prof);

        const supabase = createClient();

        // Load existing schedule
        try {
            const { data: slots } = await supabase
                .from('schedule_slots')
                .select('*')
                .eq('professional_id', prof.id);

            const newMap: ScheduleMap = {};
            [0, 1, 2, 3, 4, 5, 6].forEach(key => {
                newMap[key] = { active: false, slots: [] };
            });

            if (slots && slots.length > 0) {
                slots.forEach((slot: { day_of_week: number; start_time: string; end_time: string }) => {
                    const day = toUiDayOfWeek(slot.day_of_week);
                    if (day === null) return;
                    newMap[day].active = true;
                    newMap[day].slots.push({
                        start: slot.start_time.substring(0, 5),
                        end: slot.end_time.substring(0, 5)
                    });
                });

                // Sort slots
                Object.keys(newMap).forEach(k => {
                    newMap[Number(k)].slots.sort((a, b) => a.start.localeCompare(b.start));
                });
            } else {
                [0, 1, 2, 3, 4, 5, 6].forEach(key => {
                    newMap[key] = {
                        active: false,
                        slots: [{ start: '09:00', end: '14:00' }, { start: '16:00', end: '19:00' }]
                    };
                });
            }

            setInitialSchedule(newMap);
            setShowModal(true);
        } catch {
            toast.error('Error cargando horario del profesional');
        }
    };

    const handleDeleteRequest = async (id: string) => {
        const supabase = createClient();

        try {
            const { count } = await supabase
                .from('appointments')
                .select('id', { count: 'exact', head: true })
                .eq('professional_id', id)
                .in('status', ['pending', 'confirmed'])
                .gte('start_time', new Date().toISOString());

            const msg = count && count > 0
                ? `Este profesional tiene ${count} cita(s) futuras que quedarán sin asignar. ¿Continuar eliminación?`
                : '¿Seguro que deseas eliminar este profesional permanentemente?';

            setConfirmAction({
                title: 'Eliminar Profesional',
                message: msg,
                onConfirm: async () => {
                    setConfirmAction(null);
                    try {
                        if (count && count > 0) {
                            await supabase.from('appointments')
                                .update({ professional_id: null })
                                .eq('professional_id', id)
                                .in('status', ['pending', 'confirmed'])
                                .gte('start_time', new Date().toISOString());
                        }

                        await supabase.from('schedule_slots').delete().eq('professional_id', id);
                        await deleteProfesional.mutateAsync(id);

                        toast.success('Profesional eliminado correctamente');
                    } catch (error: unknown) {
                        const msg = error instanceof Error ? error.message : 'Error desconocido';
                        toast.error('No se pudo eliminar: ' + msg);
                    }
                }
            });
        } catch (error: unknown) {
            const errMsg = error instanceof Error ? error.message : 'Error desconocido';
            toast.error('Error al verificar citas: ' + errMsg);
        }
    };

    const handleCreateProfesional = async (data: ProfessionalFormData, scheduleMap: ScheduleMap) => {
        try {
            // Create auth user + profile + professional + services via hook (uses API route)
            const result = await createProfesional.mutateAsync({
                email: data.email,
                full_name: data.full_name,
                specialty: data.specialty || '',
                bio: data.bio || '',
                color_code: data.color_code,
                is_active: data.is_active,
                serviceIds: data.selectedServices,
            });

            const userId = result.user_id;

            // Save schedule slots
            const supabase = createClient();
            const createSlots: { professional_id: string; day_of_week: number; start_time: string; end_time: string }[] = [];
            Object.entries(scheduleMap).forEach(([dayStr, d]) => {
                const day = toDbDayOfWeek(Number(dayStr));
                if (d.active) {
                    d.slots.forEach(slot => {
                        createSlots.push({
                            professional_id: userId,
                            day_of_week: day,
                            start_time: `${slot.start}:00`,
                            end_time: `${slot.end}:00`,
                        });
                    });
                }
            });
            if (createSlots.length > 0) {
                await supabase.from('schedule_slots').insert(createSlots);
            }

            toast.success(`Profesional ${data.full_name} creado`);
            refetchPros();
            setShowModal(false);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            toast.error('Error al guardar: ' + msg);
            throw error;
        }
    };

    const handleUpdateProfesional = async (id: string, data: Partial<ProfessionalFormData>, scheduleMap: ScheduleMap) => {
        try {
            // Update professional + profile + services via hook
            await updateProfesional.mutateAsync({
                id,
                full_name: data.full_name,
                specialty: data.specialty,
                bio: data.bio,
                color_code: data.color_code,
                is_active: data.is_active,
                serviceIds: data.selectedServices,
            });

            // Save Schedule Slots
            const supabase = createClient();
            await supabase.from('schedule_slots').delete().eq('professional_id', id);

            const newSlots: { professional_id: string; day_of_week: number; start_time: string; end_time: string }[] = [];
            Object.entries(scheduleMap).forEach(([dayStr, d]) => {
                const day = toDbDayOfWeek(Number(dayStr));
                if (d.active) {
                    d.slots.forEach(slot => {
                        newSlots.push({
                            professional_id: id,
                            day_of_week: day,
                            start_time: `${slot.start}:00`,
                            end_time: `${slot.end}:00`,
                        });
                    });
                }
            });

            if (newSlots.length > 0) {
                await supabase.from('schedule_slots').insert(newSlots);
            }

            toast.success('Profesional actualizado');
            refetchPros();
            setShowModal(false);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error desconocido';
            toast.error('Error al actualizar: ' + msg);
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div className="spinner" />
            </div>
        );
    }

    const activeCount = professionals.filter((professional) => professional.is_active).length;

    return (
        <div className="content-shell section-shell section-shell--profesionales animate-in fade-in duration-500">
            <ProfesionalesHeader
                total={professionals.length}
                active={activeCount}
                services={services.length}
                onNewProfesional={handleOpenNew}
            />

            <ProfesionalesTable
                professionals={professionals}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteRequest}
            />

            {(showModal || editingProf) && (
                <ProfessionalFormModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    editing={editingProf}
                    services={services}
                    categories={categories}
                    onSubmit={handleCreateProfesional}
                    onUpdate={handleUpdateProfesional}
                    initialSchedule={initialSchedule}
                />
            )}

            {confirmAction && (
                <ConfirmModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
        </div>
    );
}
