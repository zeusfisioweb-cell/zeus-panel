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

import ConfirmModal from '@/components/ConfirmModal';
import { CategoryFormModal } from './components/CategoryFormModal';
import { ServiceFormModal } from './components/ServiceFormModal';
import { ServiciosHeader } from './components/ServiciosHeader';
import { ServiciosTable } from './components/ServiciosTable';

async function readApiError(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as { error?: string };
        return body.error || 'Error de servidor';
    } catch {
        return 'Error de servidor';
    }
}

export default function ServiciosPage() {
    const { data: services = [], isLoading: isLoadingServices } = useServicios();
    const { data: categories = [], isLoading: isLoadingCategories, refetch: refetchCategories } = useCategorias();

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
            toast.error('Crea al menos una categoria primero');
            return;
        }
        setEditingService(null);
        setShowServiceModal(true);
    }

    function handleOpenEditService(service: Service) {
        setEditingService(service);
        setShowServiceModal(true);
    }

    async function handleServiceSubmit(data: Omit<Service, 'id' | 'created_at' | 'category'>) {
        try {
            await createService.mutateAsync(data);
            toast.success('Servicio creado con exito');
        } catch (error: unknown) {
            toast.error(`Error al crear el servicio: ${getErrorMessage(error)}`);
            throw error;
        }
    }

    async function handleServiceUpdate(id: string, data: Partial<Service>) {
        try {
            await updateService.mutateAsync({ id, ...data });
            toast.success('Servicio actualizado con exito');
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

            toast.success('Categoria creada con exito');
            refetchCategories();
        } catch (error: unknown) {
            toast.error(`Error al crear la categoria: ${getErrorMessage(error)}`);
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="content-shell section-shell section-shell--servicios ops-screen animate-in fade-in duration-500">
            <ServiciosHeader
                servicesCount={services.length}
                categoriesCount={categories.length}
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
