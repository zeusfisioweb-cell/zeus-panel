'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { Patient, Appointment, ClinicalRecord, RecordType } from '@/lib/types';
import { usePacientes, useCreatePaciente, useUpdatePaciente, useDeletePaciente } from '@/hooks/usePacientes';

import ConfirmModal from '@/components/ConfirmModal';
import { PacientesHeader } from './components/PacientesHeader';
import { PacientesTable } from './components/PacientesTable';
import { PatientFormModal, PatientFormData } from './components/PatientFormModal';
import { ClinicalRecordFormModal } from './components/ClinicalRecordFormModal';
import { PatientDetailsPanel } from './components/PatientDetailsPanel';


export default function PacientesPage() {
    // Stable Supabase instance — inside component, not module scope
    const [supabase] = useState(() => createClient());

    // Local State
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 50;

    // Queries
    // Usamos el hook modificado que retorna data y count
    const { data: result, isLoading: isLoadingPatients, refetch: refetchPatients } = usePacientes({
        searchTerm: debouncedSearch,
        page,
        pageSize
    });
    const patients = result?.data || [];
    const totalCount = result?.count || 0;

    // Mutations
    const createPaciente = useCreatePaciente();
    const updatePaciente = useUpdatePaciente();
    const deletePaciente = useDeletePaciente();

    // Detail State
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
    const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);

    // Debounce the search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1); // Reset to first page when searching
        }, 500);
        return () => clearTimeout(handler);
    }, [search]);

    // Modals Local State
    const [showNewModal, setShowNewModal] = useState(false);
    const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
    const [showRecordModal, setShowRecordModal] = useState(false);
    const [recordType, setRecordType] = useState<RecordType>('evolution');
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    // Helpers to load detail data
    const loadPatientDetails = async (patientId: string) => {
        try {
            const [appointmentsRes, recordsRes] = await Promise.all([
                supabase
                    .from('appointments')
                    .select('*, service:services(name)')
                    .eq('patient_id', patientId)
                    .order('start_time', { ascending: false })
                    .limit(20),
                supabase
                    .from('clinical_records')
                    .select('*, professional:professionals(profile:profiles(full_name))')
                    .eq('patient_id', patientId)
                    .order('created_at', { ascending: false })
            ]);

            setPatientAppointments(appointmentsRes.data as Appointment[] || []);
            setClinicalRecords(recordsRes.data as unknown as ClinicalRecord[] || []);
        } catch (error) {
            toast.error('Error cargando los detalles del paciente');
        }
    };

    const handleViewPatient = (p: Patient) => {
        setSelectedPatient(p);
        loadPatientDetails(p.id);
    };

    // Patient Form Handlers
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
            refetchPatients(); // Though React Query does it automatically sometimes based on mutation config
        } catch (error: any) {
            toast.error('Error al crear paciente: ' + error.message);
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

            // Re-sync local selected patient if it's the one being edited
            if (selectedPatient?.id === editingPatient.id) {
                setSelectedPatient({ ...selectedPatient, ...payload });
            }

            refetchPatients();
        } catch (error: any) {
            toast.error('Error al actualizar: ' + error.message);
            throw error;
        }
    };

    const handleDeletePatientConfirm = (id: string) => {
        setConfirmAction({
            title: 'Eliminar paciente',
            message: '¿Seguro que deseas eliminar este paciente y todo su historial? Esta acción no se puede deshacer.',
            onConfirm: async () => {
                try {
                    const { error: recordsErr } = await supabase.from('clinical_records').delete().eq('patient_id', id);
                    if (recordsErr) throw recordsErr;

                    const { error: consentErr } = await supabase.from('consent_records').delete().eq('patient_id', id);
                    if (consentErr) throw consentErr;

                    const { error: aptsErr } = await supabase.from('appointments').update({ patient_id: null }).eq('patient_id', id);
                    if (aptsErr) throw aptsErr;

                    await deletePaciente.mutateAsync(id);

                    setSelectedPatient(null);
                    setConfirmAction(null);
                    toast.success('Paciente eliminado');
                } catch (error: unknown) {
                    const msg = error instanceof Error ? error.message : 'Error desconocido';
                    toast.error('Error al eliminar paciente: ' + msg);
                }
            }
        });
    };

    // Clinical Records Handlers
    const handleOpenRecordModal = (type: RecordType) => {
        setRecordType(type);
        setShowRecordModal(true);
    };

    const handleSaveRecord = async (type: RecordType, recordFields: string[]) => {
        if (!selectedPatient) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Re-construct the content using the external RECORD_FIELDS definition
            // To keep things simple, we fetch the module dynamically or hardcode the labels here?
            // Usually, this logic is safer inside the form, yielding a complete JSON object.
            // But since the form just yielded the array of strings, we need the labels:
            const { RECORD_FIELDS } = await import('./components/ClinicalRecordFormModal');

            const content: Record<string, string> = {};
            RECORD_FIELDS[type].forEach((field: { label: string }, idx: number) => {
                content[field.label] = recordFields[idx] || '';
            });

            const { error } = await supabase.from('clinical_records').insert({
                patient_id: selectedPatient.id,
                professional_id: user?.id,
                type,
                content,
            });

            if (error) throw error;

            toast.success('Ficha clínica guardada');
            loadPatientDetails(selectedPatient.id);
        } catch (error: any) {
            toast.error('Error al guardar ficha: ' + error.message);
            throw error;
        }
    };

    const handleDeleteRecordConfirm = (id: string) => {
        setConfirmAction({
            title: 'Eliminar ficha clínica',
            message: '¿Seguro que deseas eliminar esta ficha clínica?',
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from('clinical_records').delete().eq('id', id);
                    if (error) throw error;

                    if (selectedPatient) loadPatientDetails(selectedPatient.id);
                    setConfirmAction(null);
                    toast.success('Ficha eliminada');
                } catch (error: any) {
                    toast.error('Error al eliminar ficha: ' + error.message);
                }
            }
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
        <div className="content-shell section-shell section-shell--pacientes animate-in fade-in duration-500">
            <PacientesHeader
                totalCount={totalCount}
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

            {/* Modals */}
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
