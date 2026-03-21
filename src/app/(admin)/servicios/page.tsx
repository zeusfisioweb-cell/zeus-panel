'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Service } from '@/lib/types';
import {
    useServicios,
    useCategorias,
    useCreateServicio,
    useUpdateServicio,
    useDeleteServicio
} from '@/hooks/useServicios';

import ConfirmModal from '@/components/ConfirmModal';
import { ServiciosHeader } from './components/ServiciosHeader';
import { ServiciosTable } from './components/ServiciosTable';
import { CategoryFormModal } from './components/CategoryFormModal';
import { ServiceFormModal } from './components/ServiceFormModal';

export default function ServiciosPage() {
    const [supabase] = useState(() => createClient());
    // Queries
    const { data: services = [], isLoading: isLoadingServices } = useServicios();
    const { data: categories = [], isLoading: isLoadingCategories, refetch: refetchCategories } = useCategorias();

    // Mutations
    const createService = useCreateServicio();
    const updateService = useUpdateServicio();
    const deleteService = useDeleteServicio();

    // Modal states
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const isLoading = isLoadingServices || isLoadingCategories;

    // Handlers
    function handleOpenNewService() {
        if (categories.length === 0) {
            toast.error('Crea al menos una categoría primero');
            return;
        }
        setEditingService(null);
        setShowServiceModal(true);
    }

    function handleOpenEditService(s: Service) {
        setEditingService(s);
        setShowServiceModal(true);
    }

    async function handleServiceSubmit(data: Omit<Service, 'id' | 'created_at' | 'category'>) {
        try {
            await createService.mutateAsync(data as any);
            toast.success('Servicio creado con éxito');
        } catch (error: any) {
            toast.error('Error al crear el servicio: ' + error.message);
            throw error;
        }
    }

    async function handleServiceUpdate(id: string, data: Partial<Service>) {
        try {
            await updateService.mutateAsync({ id, ...data });
            toast.success('Servicio actualizado con éxito');
        } catch (error: any) {
            toast.error('Error al actualizar el servicio: ' + error.message);
            throw error;
        }
    }

    async function handleCategorySubmit(data: { name: string; is_active: boolean; display_order: number }) {
        try {
            const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const { error } = await supabase.from('service_categories').insert({
                ...data,
                slug,
            });

            if (error) throw error;
            toast.success('Categoría creada con éxito');
            // Optimistically or manually refetch the categories
            refetchCategories();
        } catch (error: any) {
            toast.error('Error al crear la categoría: ' + error.message);
            throw error;
        }
    }

    function handleDeleteServiceRequest(id: string) {
        setConfirmAction({
            title: 'Eliminar servicio',
            message: '¿Seguro que quieres eliminar este servicio de forma permanente? Esta acción no se puede deshacer.',
            onConfirm: async () => {
                setConfirmAction(null);

                // Keep the complex validation here or move to a backend function/RPC
                try {
                    const { count } = await supabase
                        .from('appointments')
                        .select('id', { count: 'exact', head: true })
                        .eq('service_id', id)
                        .in('status', ['pending', 'confirmed'])
                        .gte('start_time', new Date().toISOString());

                    if (count && count > 0) {
                        toast.error(`No se puede eliminar: hay ${count} cita(s) futuras con este servicio. Desactívalo en su lugar.`);
                        return;
                    }

                    await supabase.from('professional_services').delete().eq('service_id', id);
                    await deleteService.mutateAsync(id);
                    toast.success('Servicio eliminado permanente');
                } catch (error: any) {
                    toast.error('Error al eliminar: ' + error.message);
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
        <div className="content-shell section-shell section-shell--servicios animate-in fade-in duration-500">
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
