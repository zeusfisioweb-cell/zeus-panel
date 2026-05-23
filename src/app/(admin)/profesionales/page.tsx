'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import type { Professional } from '@/lib/types';
import { toDbDayOfWeek, toUiDayOfWeek } from '@/lib/types';
import { useCreateProfesional, useDeleteProfesional, useProfesionales, useUpdateProfesional } from '@/hooks/useProfesionales';
import { useCategorias, useServicios } from '@/hooks/useServicios';

import ConfirmModal from '@/components/ConfirmModal';
import { ProfesionalesHeader } from './components/ProfesionalesHeader';
import { ProfessionalFormData, ProfessionalFormModal, ScheduleMap } from './components/ProfessionalFormModal';
import { ProfesionalesTable } from './components/ProfesionalesTable';
import { readApiError } from '@/lib/api-helpers';


export default function ProfesionalesPage() {
    const { data: professionals = [], isLoading: isLoadingPros, refetch: refetchPros } = useProfesionales();
    const { data: services = [], isLoading: isLoadingServices } = useServicios();
    const { data: categories = [], isLoading: isLoadingCategories } = useCategorias();

    const createProfesional = useCreateProfesional();
    const updateProfesional = useUpdateProfesional();
    const deleteProfesional = useDeleteProfesional();

    const [showModal, setShowModal] = useState(false);
    const [editingProf, setEditingProf] = useState<Professional | null>(null);
    const [initialSchedule, setInitialSchedule] = useState<ScheduleMap | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const [resendingId, setResendingId] = useState<string | null>(null);

    const handleResendWelcome = async (pro: Professional) => {
        setResendingId(pro.id);
        try {
            const response = await fetch(
                `/api/admin/professionals/${encodeURIComponent(pro.id)}/resend-welcome`,
                { method: 'POST', credentials: 'same-origin' },
            );
            if (!response.ok) {
                throw new Error(await readApiError(response));
            }
            toast.success(`Email enviado a ${pro.profile?.email || 'el profesional'}`);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(`No se pudo enviar: ${message}`);
        } finally {
            setResendingId(null);
        }
    };

    const isLoading = isLoadingPros || isLoadingServices || isLoadingCategories;

    const handleOpenNew = () => {
        setEditingProf(null);

        const defaultMap: ScheduleMap = {};
        [0, 1, 2, 3, 4, 5, 6].forEach((day) => {
            defaultMap[day] = {
                active: day >= 0 && day <= 4,
                slots: day >= 0 && day <= 4
                    ? [{ start: '09:00', end: '14:00' }, { start: '16:00', end: '19:00' }]
                    : [],
            };
        });

        setInitialSchedule(defaultMap);
        setShowModal(true);
    };

    const handleOpenEdit = async (professional: Professional) => {
        setEditingProf(professional);

        try {
            const response = await fetch(`/api/admin/professionals/${encodeURIComponent(professional.id)}/schedule`, {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const slots = (await response.json()) as Array<{
                day_of_week: number;
                start_time: string;
                end_time: string;
            }>;

            const newMap: ScheduleMap = {};
            [0, 1, 2, 3, 4, 5, 6].forEach((key) => {
                newMap[key] = { active: false, slots: [] };
            });

            if (slots.length > 0) {
                slots.forEach((slot) => {
                    const day = toUiDayOfWeek(slot.day_of_week);
                    if (day === null) return;

                    newMap[day].active = true;
                    newMap[day].slots.push({
                        start: slot.start_time.substring(0, 5),
                        end: slot.end_time.substring(0, 5),
                    });
                });

                Object.keys(newMap).forEach((key) => {
                    newMap[Number(key)].slots.sort((a, b) => a.start.localeCompare(b.start));
                });
            } else {
                [0, 1, 2, 3, 4, 5, 6].forEach((key) => {
                    newMap[key] = {
                        active: false,
                        slots: [{ start: '09:00', end: '14:00' }, { start: '16:00', end: '19:00' }],
                    };
                });
            }

            setInitialSchedule(newMap);
            setShowModal(true);
        } catch {
            toast.error('Error cargando horario del profesional');
        }
    };

    const handleDeleteRequest = (id: string) => {
        setConfirmAction({
            title: 'Eliminar profesional',
            message: '¿Seguro que deseas eliminar este profesional? Si tiene citas futuras, se desasignarán automáticamente.',
            onConfirm: async () => {
                setConfirmAction(null);
                try {
                    const result = await deleteProfesional.mutateAsync(id);
                    if (result.reassignedAppointments > 0) {
                        toast.success(`Profesional eliminado. Citas desasignadas: ${result.reassignedAppointments}`);
                    } else {
                        toast.success('Profesional eliminado correctamente');
                    }
                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Error desconocido';
                    toast.error(`No se pudo eliminar: ${message}`);
                }
            },
        });
    };

    const handleCreateProfesional = async (data: ProfessionalFormData, scheduleMap: ScheduleMap) => {
        try {
            const scheduleSlots: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];

            Object.entries(scheduleMap).forEach(([dayStr, dayData]) => {
                const day = toDbDayOfWeek(Number(dayStr));
                if (dayData.active) {
                    dayData.slots.forEach((slot) => {
                        scheduleSlots.push({
                            day_of_week: day,
                            start_time: `${slot.start}:00`,
                            end_time: `${slot.end}:00`,
                        });
                    });
                }
            });

            await createProfesional.mutateAsync({
                email: data.email,
                full_name: data.full_name,
                specialty: data.specialty || '',
                bio: data.bio || '',
                color_code: data.color_code,
                is_active: data.is_active,
                serviceIds: data.selectedServices,
                scheduleSlots,
            });

            toast.success(`Profesional ${data.full_name} creado`);
            refetchPros();
            setShowModal(false);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(`Error al guardar: ${message}`);
            throw error;
        }
    };

    const handleUpdateProfesional = async (id: string, data: Partial<ProfessionalFormData>, scheduleMap: ScheduleMap) => {
        try {
            await updateProfesional.mutateAsync({
                id,
                full_name: data.full_name,
                email: data.email,
                specialty: data.specialty,
                bio: data.bio,
                color_code: data.color_code,
                is_active: data.is_active,
                serviceIds: data.selectedServices,
            });

            const slots: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];
            Object.entries(scheduleMap).forEach(([dayStr, dayData]) => {
                const day = toDbDayOfWeek(Number(dayStr));
                if (dayData.active) {
                    dayData.slots.forEach((slot) => {
                        slots.push({
                            day_of_week: day,
                            start_time: `${slot.start}:00`,
                            end_time: `${slot.end}:00`,
                        });
                    });
                }
            });

            const scheduleResponse = await fetch(`/api/admin/professionals/${encodeURIComponent(id)}/schedule`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ slots }),
            });

            if (!scheduleResponse.ok) {
                throw new Error(await readApiError(scheduleResponse));
            }

            toast.success('Profesional actualizado');
            refetchPros();
            setShowModal(false);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            toast.error(`Error al actualizar: ${message}`);
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="spinner" />
            </div>
        );
    }

    const servicesById = new Map(services.map((svc) => [svc.id, svc] as const));
    const enrichedProfessionals = professionals.map((pro) => ({
        ...pro,
        services: (pro.professional_services ?? [])
            .map((link) => servicesById.get(link.service_id))
            .filter((svc): svc is NonNullable<typeof svc> => svc !== undefined),
    }));

    const activeCount = enrichedProfessionals.filter((professional) => professional.is_active).length;
    const specialtiesCount = new Set(enrichedProfessionals.filter((p) => p.specialty).map((p) => p.specialty?.trim().toLowerCase())).size;
    const totalServicesLinked = enrichedProfessionals.reduce((acc, p) => acc + (p.professional_services?.length || 0), 0);
    const avgServicesPerPro = enrichedProfessionals.length > 0 ? totalServicesLinked / enrichedProfessionals.length : 0;

    return (
        <div className="content-shell section-shell flex flex-col gap-8 animate-in fade-in duration-500">
            <ProfesionalesHeader
                total={enrichedProfessionals.length}
                active={activeCount}
                specialties={specialtiesCount}
                assignedServices={totalServicesLinked}
                avgServicesPerPro={avgServicesPerPro}
                onNewProfesional={handleOpenNew}
            />

            <ProfesionalesTable
                professionals={enrichedProfessionals}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteRequest}
                onResendWelcome={handleResendWelcome}
                resendingId={resendingId}
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
