'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Appointment, Patient, PatientDocument } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useCreatePaciente, useDeletePaciente, usePacientes, useUpdatePaciente } from '@/hooks/usePacientes';

import ConfirmModal from '@/components/ConfirmModal';
import { PacientesHeader } from './components/PacientesHeader';
import { PacientesTable } from './components/PacientesTable';
import { PatientDetailsPanel } from './components/PatientDetailsPanel';
import { PatientDocumentModal } from './components/PatientDocumentModal';
import { PatientFormData, PatientFormModal } from './components/PatientFormModal';
import { readApiError } from '@/lib/api-helpers';


export default function PacientesPage() {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 50;

    const { data: result, isLoading: isLoadingPatients, refetch: refetchPatients } = usePacientes({
        searchTerm: debouncedSearch,
        page,
        pageSize,
    });
    const patients = result?.data || [];
    const totalCount = result?.count || 0;

    const { profile } = useAuth();

    const createPaciente = useCreatePaciente();
    const updatePaciente = useUpdatePaciente();
    const deletePaciente = useDeletePaciente();

    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
    const [patientDocuments, setPatientDocuments] = useState<PatientDocument[]>([]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);
        return () => clearTimeout(handler);
    }, [search]);

    const [showNewModal, setShowNewModal] = useState(false);
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [editingDocument, setEditingDocument] = useState<PatientDocument | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        return 'Error desconocido';
    };

    const loadPatientDetails = async (patientId: string) => {
        try {
            const [detailsResponse, docsResponse] = await Promise.all([
                fetch(`/api/admin/patients/${encodeURIComponent(patientId)}/details`, {
                    method: 'GET',
                    credentials: 'same-origin',
                }),
                fetch(`/api/admin/patients/${encodeURIComponent(patientId)}/documents`, {
                    method: 'GET',
                    credentials: 'same-origin',
                }),
            ]);

            if (!detailsResponse.ok) {
                throw new Error(await readApiError(detailsResponse));
            }

            const detailsPayload = (await detailsResponse.json()) as {
                appointments: Appointment[];
            };

            setPatientAppointments(detailsPayload.appointments ?? []);

            if (!docsResponse.ok) {
                throw new Error(await readApiError(docsResponse));
            }

            const documentsPayload = (await docsResponse.json()) as {
                documents: PatientDocument[];
            };
            setPatientDocuments(documentsPayload.documents ?? []);
        } catch {
            toast.error('Error cargando los detalles del paciente');
        }
    };

    const handleViewPatient = (patient: Patient) => {
        setEditingDocument(null);
        setSelectedPatient(patient);
        void loadPatientDetails(patient.id);
    };

    const handleCreatePatient = async (data: PatientFormData) => {
        try {
            const payload = {
                first_name: data.first_name,
                last_name: data.last_name,
                document_id: data.document_id || null,
                phone: data.phone || null,
                email: data.email || null,
                birth_date: data.birth_date || null,
                address: data.address || null,
                gdpr_consent: data.gdpr_consent,
                marketing_consent: data.marketing_consent,
            };
            await createPaciente.mutateAsync(payload);
            toast.success('Paciente creado correctamente');
            refetchPatients();
        } catch (error: unknown) {
            toast.error(`Error al crear paciente: ${getErrorMessage(error)}`);
            throw error;
        }
    };

    const handleUpdatePatient = async (data: PatientFormData) => {
        if (!editingPatient) return;

        try {
            const payload = {
                id: editingPatient.id,
                first_name: data.first_name,
                last_name: data.last_name,
                document_id: data.document_id || null,
                phone: data.phone || null,
                email: data.email || null,
                birth_date: data.birth_date || null,
                address: data.address || null,
                gdpr_consent: data.gdpr_consent,
                marketing_consent: data.marketing_consent,
            };

            await updatePaciente.mutateAsync(payload);
            toast.success('Paciente actualizado');

            if (selectedPatient?.id === editingPatient.id) {
                setSelectedPatient({ ...selectedPatient, ...payload });
            }

            refetchPatients();
        } catch (error: unknown) {
            toast.error(`Error al actualizar: ${getErrorMessage(error)}`);
            throw error;
        }
    };

    const handleDeletePatientConfirm = (id: string) => {
        setConfirmAction({
            title: 'Eliminar paciente',
            message: '¿Seguro que deseas eliminar este paciente y su historial? Esta acción no se puede deshacer.',
            onConfirm: async () => {
                try {
                    await deletePaciente.mutateAsync(id);
                    setSelectedPatient(null);
                    setConfirmAction(null);
                    toast.success('Paciente eliminado');
                } catch (error: unknown) {
                    toast.error(`Error al eliminar paciente: ${getErrorMessage(error)}`);
                }
            },
        });
    };

    const handleUnlinkPortal = (id: string) => {
        setSelectedPatient(prev => prev?.id === id ? { ...prev, auth_user_id: null } : prev);
    };

    const handleDocumentSaved = (updated: PatientDocument) => {
        setPatientDocuments((prev) => prev.map((doc) => (doc.id === updated.id ? updated : doc)));
    };

    if (isLoadingPatients) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="content-shell section-shell section-shell--pacientes ops-screen animate-in fade-in duration-500">
            <PacientesHeader
                totalCount={totalCount}
                consentCount={patients.filter((p) => p.gdpr_consent).length}
                onNewPaciente={() => setShowNewModal(true)}
            />

            <div className={`patients-layout ${selectedPatient ? 'patients-layout--with-detail' : ''}`}>
                <div className="patients-layout__main">
                    <PacientesTable
                        patients={patients}
                        search={search}
                        onSearchChange={setSearch}
                        onViewPatient={handleViewPatient}
                        selectedPatientId={selectedPatient?.id}
                        page={page}
                        pageSize={pageSize}
                        totalCount={totalCount}
                        onPageChange={setPage}
                    />
                </div>

                {selectedPatient && (
                    <div className="patients-layout__detail">
                        <PatientDetailsPanel
                            patient={selectedPatient}
                            appointments={patientAppointments}
                            documents={patientDocuments}
                            userRole={profile?.role}
                            onClose={() => {
                                setEditingDocument(null);
                                setSelectedPatient(null);
                            }}
                            onEdit={() => setEditingPatient(selectedPatient)}
                            onDelete={handleDeletePatientConfirm}
                            onEditDocument={setEditingDocument}
                            onUnlinkPortal={handleUnlinkPortal}
                        />
                    </div>
                )}
            </div>

            <PatientFormModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                editing={null}
                onSubmit={handleCreatePatient}
            />

            {editingPatient && (
                <PatientFormModal
                    isOpen={true}
                    onClose={() => setEditingPatient(null)}
                    editing={editingPatient}
                    onSubmit={handleUpdatePatient}
                />
            )}

            <PatientDocumentModal
                isOpen={Boolean(editingDocument) && Boolean(selectedPatient)}
                patientId={selectedPatient?.id ?? ''}
                patientName={selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : ''}
                document={editingDocument}
                onClose={() => setEditingDocument(null)}
                onSaved={handleDocumentSaved}
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
