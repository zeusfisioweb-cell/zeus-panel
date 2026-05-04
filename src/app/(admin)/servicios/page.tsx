'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { Service } from '@/lib/types';
import {
    useCategorias,
    useCreateServicio,
    useDeleteServicio,
    useServicios,
    useUpdateServicio,
} from '@/hooks/useServicios';
import { useProfesionales } from '@/hooks/useProfesionales';

import ConfirmModal from '@/components/ConfirmModal';
import { CategoryFormModal } from './components/CategoryFormModal';
import { ServiceFormModal } from './components/ServiceFormModal';
import { ServiciosHeader } from './components/ServiciosHeader';
import { ServiciosTable } from './components/ServiciosTable';
import { readApiError } from '@/lib/api-helpers';


export default function ServiciosPage() {
    const { data: services = [], isLoading: isLoadingServices } = useServicios();
    const { data: categories = [], isLoading: isLoadingCategories, refetch: refetchCategories } = useCategorias();
    const { data: professionals = [] } = useProfesionales();

    const createService = useCreateServicio();
    const updateService = useUpdateServicio();
    const deleteService = useDeleteServicio();

    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const isLoading = isLoadingServices || isLoadingCategories;

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        return 'Error desconocido';
    };

    function handleOpenNewService() {
        if (categories.length === 0) {
            toast.error('Crea al menos una categoría primero');
            return;
        }
        setEditingService(null);
        setShowServiceModal(true);
    }

    function handleOpenEditService(service: Service) {
        setEditingService(service);
        setShowServiceModal(true);
    }

    async function handleServiceSubmit(data: Omit<Service, 'id' | 'created_at' | 'category' | 'professional_services'> & { professional_ids: string[] }) {
        try {
            await createService.mutateAsync(data as Parameters<typeof createService.mutateAsync>[0]);
            toast.success('Servicio creado con éxito');
        } catch (error: unknown) {
            toast.error(`Error al crear el servicio: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    async function handleServiceUpdate(id: string, data: Partial<Service> & { professional_ids: string[] }) {
        try {
            await updateService.mutateAsync({ id, ...data } as Parameters<typeof updateService.mutateAsync>[0]);
            toast.success('Servicio actualizado con éxito');
        } catch (error: unknown) {
            toast.error(`Error al actualizar el servicio: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    async function handleCategorySubmit(data: { name: string; is_active: boolean; display_order: number }) {
        try {
            const response = await fetch('/api/admin/service-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            toast.success('Categoría creada con éxito');
            refetchCategories();
        } catch (error: unknown) {
            toast.error(`Error al crear la categoría: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    function handleDeleteServiceRequest(id: string) {
        setConfirmAction({
            title: 'Eliminar servicio',
            message: 'Seguro que quieres eliminar este servicio de forma permanente? Esta accion no se puede deshacer.',
            onConfirm: async () => {
                setConfirmAction(null);
                try {
                    await deleteService.mutateAsync(id);
                    toast.success('Servicio eliminado permanentemente');
                } catch (error: unknown) {
                    toast.error(`Error al eliminar: ${getErrorMessage(error)}`);
                }
            },
        });
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="content-shell section-shell section-shell--servicios ops-screen animate-in fade-in duration-500">
            <ServiciosHeader
                servicesCount={services.length}
                categoriesCount={categories.length}
                activeCount={services.filter((s) => s.is_active).length}
                avgPrice={services.length > 0 ? services.reduce((acc, s) => acc + Number(s.price), 0) / services.length : 0}
                onNewCategory={() => setShowCategoryModal(true)}
                onNewService={handleOpenNewService}
            />

            <ServiciosTable
                categories={categories}
                services={services}
                onEdit={handleOpenEditService}
                onDelete={handleDeleteServiceRequest}
            />

            <ServiceFormModal
                isOpen={showServiceModal}
                onClose={() => setShowServiceModal(false)}
                editing={editingService}
                categories={categories}
                professionals={professionals}
                onSubmit={handleServiceSubmit}
                onUpdate={handleServiceUpdate}
            />

            <CategoryFormModal
                isOpen={showCategoryModal}
                onClose={() => setShowCategoryModal(false)}
                categoriesCount={categories.length}
                onSubmit={handleCategorySubmit}
            />

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
