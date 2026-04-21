'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Appointment, ClinicalRecord, Patient, RecordType } from '@/lib/types';
import { useCreatePaciente, useDeletePaciente, usePacientes, useUpdatePaciente } from '@/hooks/usePacientes';

import ConfirmModal from '@/components/ConfirmModal';
import { ClinicalRecordFormModal } from './components/ClinicalRecordFormModal';
import { PacientesHeader } from './components/PacientesHeader';
import { PacientesTable } from './components/PacientesTable';
import { PatientDetailsPanel } from './components/PatientDetailsPanel';
import { PatientFormData, PatientFormModal } from './components/PatientFormModal';

async function readApiError(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as { error?: string };
        return body.error || 'Error de servidor';
    } catch {
        return 'Error de servidor';
    }
}

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

    const createPaciente = useCreatePaciente();
    const updatePaciente = useUpdatePaciente();
    const deletePaciente = useDeletePaciente();

    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
    const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);
        return () => clearTimeout(handler);
    }, [search]);

    const [showNewModal, setShowNewModal] = useState(false);
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [showRecordModal, setShowRecordModal] = useState(false);
    const [recordType, setRecordType] = useState<RecordType>('evolution');
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        return 'Error desconocido';
    };

    const loadPatientDetails = async (patientId: string) => {
        try {
            const response = await fetch(`/api/admin/patients/${encodeURIComponent(patientId)}/details`, {
                method: 'GET',
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            const payload = (await response.json()) as {
                appointments: Appointment[];
                records: ClinicalRecord[];
            };

            setPatientAppointments(payload.appointments ?? []);
            setClinicalRecords(payload.records ?? []);
        } catch {
            toast.error('Error cargando los detalles del paciente');
        }
    };

    const handleViewPatient = (patient: Patient) => {
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
            message: 'Seguro que deseas eliminar este paciente y su historial? Esta accion no se puede deshacer.',
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

    const handleOpenRecordModal = (type: RecordType) => {
        setRecordType(type);
        setShowRecordModal(true);
    };

    const handleSaveRecord = async (type: RecordType, recordFields: string[]) => {
        if (!selectedPatient) return;

        try {
            const { RECORD_FIELDS } = await import('./components/ClinicalRecordFormModal');
            const content: Record<string, string> = {};

            RECORD_FIELDS[type].forEach((field: { key: string }, index: number) => {
                content[field.key] = recordFields[index] || '';
            });

            const response = await fetch('/api/admin/clinical-records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    patient_id: selectedPatient.id,
                    type,
                    content,
                }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response));
            }

            toast.success('Ficha clinica guardada');
            await loadPatientDetails(selectedPatient.id);
        } catch (error: unknown) {
            toast.error(`Error al guardar ficha: ${getErrorMessage(error)}`);
            throw error;
        }
    };

    const handleDeleteRecordConfirm = (id: string) => {
        setConfirmAction({
            title: 'Eliminar ficha clinica',
            message: 'Seguro que deseas eliminar esta ficha clinica?',
            onConfirm: async () => {
                try {
                    const response = await fetch(`/api/admin/clinical-records/${encodeURIComponent(id)}`, {
                        method: 'DELETE',
                        credentials: 'same-origin',
                    });

                    if (!response.ok) {
                        throw new Error(await readApiError(response));
                    }

                    if (selectedPatient) {
                        await loadPatientDetails(selectedPatient.id);
                    }

                    setConfirmAction(null);
                    toast.success('Ficha eliminada');
                } catch (error: unknown) {
                    toast.error(`Error al eliminar ficha: ${getErrorMessage(error)}`);
                }
            },
        });
    };

    if (isLoadingPatients) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="content-shell section-shell section-shell--pacientes ops-screen animate-in fade-in duration-500">
            <PacientesHeader totalCount={totalCount} onNewPaciente={() => setShowNewModal(true)} />

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
                            records={clinicalRecords}
                            onClose={() => setSelectedPatient(null)}
                            onEdit={() => setEditingPatient(selectedPatient)}
                            onDelete={handleDeletePatientConfirm}
                            onNewRecord={handleOpenRecordModal}
                            onDeleteRecord={handleDeleteRecordConfirm}
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

            {showRecordModal && (
                <ClinicalRecordFormModal
                    isOpen={showRecordModal}
                    onClose={() => setShowRecordModal(false)}
                    initialType={recordType}
                    onSubmit={handleSaveRecord}
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
