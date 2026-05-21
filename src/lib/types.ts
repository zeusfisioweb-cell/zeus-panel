// Database types for the Zeus appointment system

export type UserRole = 'owner' | 'professional' | 'client';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type RecordType = 'anamnesis' | 'exploration' | 'evolution' | 'report';
export type ConsentType = 'gdpr' | 'informed' | 'marketing';
export type AppointmentSource = 'web' | 'admin' | 'phone';
export type PatientDocumentType = 'clinical_history' | 'intervention_consent' | 'data_consent';
export type PatientDocumentStatus = 'draft' | 'completed' | 'signed';
export type PaymentMethod = 'cash' | 'card' | 'bizum' | 'transfer' | 'other';

export interface Profile {
    id: string;
    email: string;
    role: UserRole;
    full_name: string | null;
    professional_id?: string | null;
    created_at: string;
}

export interface ServiceCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    color: string;
    display_order: number;
    is_active: boolean;
    created_at: string;
}

export interface Service {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number;
    requires_medical_history: boolean;
    is_active: boolean;
    category_id: string | null;
    created_at: string;
    // Joined
    category?: ServiceCategory;
    professional_services?: Array<{ professional_id: string }>;
}

export interface Professional {
    id: string;
    specialty: string | null;
    license_number: string | null;
    bio: string | null;
    color_code: string;
    is_active: boolean;
    created_at: string;
    // Joined
    profile?: Profile;
    services?: Service[];
    professional_services?: Array<{ service_id: string }>;
}

export interface Patient {
    id: string;
    first_name: string;
    last_name: string;
    document_id: string | null;
    phone: string | null;
    email: string | null;
    birth_date: string | null;
    address: string | null;
    gdpr_consent: boolean;
    marketing_consent: boolean;
    auth_user_id?: string | null;
    guardian_auth_user_id?: string | null;
    gdpr_consented_by_guardian?: boolean;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

export interface Appointment {
    id: string;
    patient_id: string | null;
    professional_id: string | null;
    service_id: string | null;
    start_time: string;
    end_time: string;
    status: AppointmentStatus;
    notes: string | null;
    patient_name: string | null;
    patient_phone: string | null;
    patient_email: string | null;
    source: AppointmentSource;
    cancellation_reason: string | null;
    created_at: string;
    updated_at: string;
    // Joined
    patient?: Patient;
    professional?: Professional;
    service?: Service;
}

export interface ScheduleSlot {
    id: string;
    professional_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_active: boolean;
    created_at: string;
}

export interface ScheduleException {
    id: string;
    professional_id: string;
    exception_date: string;
    is_available: boolean;
    start_time: string | null;
    end_time: string | null;
    reason: string | null;
    created_at: string;
}

export interface ProfessionalOption {
    id: string;
    profile: { full_name: string } | null;
}

export interface BookingSettings {
    id: string;
    clinic_name: string;
    legal_name: string | null;
    tax_id: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    booking_advance_days: number;
    min_booking_notice_hours: number;
    cancellation_hours: number;
    slot_interval_minutes: number;
    buffer_minutes: number;
    gdpr_text: string | null;
    informed_consent_text: string | null;
    privacy_policy_url: string | null;
    terms_url: string | null;
    opening_hour: string;
    closing_hour: string;
    updated_at: string;
}

export interface DashboardSessionBreakdownItem {
    name: string;
    value: number;
}

export interface DashboardGlobalStatus {
    confirmed: number;
    completed: number;
    cancelled: number;
}

export interface DashboardStatsSummary {
    todayCount: number;
    weekCount: number;
    totalPatients: number;
}

export interface DashboardGlobalStats {
    estimatedRevenue: number;
    totalGlobalAppointments: number;
    sessionBreakdown: DashboardSessionBreakdownItem[];
    globalStatus: DashboardGlobalStatus;
}

export interface DashboardData {
    todayAppointments: Appointment[];
    stats: DashboardStatsSummary;
    globalStats: DashboardGlobalStats;
    services: Service[];
    professionals: Professional[];
}

export interface ConsentRecord {
    id: string;
    patient_id: string;
    appointment_id: string | null;
    consent_type: ConsentType;
    consent_text: string;
    granted: boolean;
    ip_address: string | null;
    user_agent: string | null;
    granted_at: string;
    revoked_at: string | null;
}

export interface ClinicalRecord {
    id: string;
    patient_id: string;
    professional_id: string;
    type: RecordType;
    content: Record<string, unknown>;
    attachments: string[] | null;
    created_at: string;
    updated_at: string;
    // Joined
    professional?: { profile?: { full_name: string | null } };
}

export interface PatientDocument {
    id: string;
    patient_id: string;
    document_type: PatientDocumentType;
    title: string;
    template_file_name: string;
    status: PatientDocumentStatus;
    form_data: Record<string, unknown>;
    notes: string | null;
    file_url: string | null;
    visit_date: string | null;
    completed_at: string | null;
    signed_at: string | null;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}

// Day names for schedule display (UI order: 0=Lunes .. 6=Domingo)
export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Convert database day_of_week to UI index.
// Canonical DB mapping is 1=Lunes .. 7=Domingo.
// Legacy rows may still use 0=Lunes .. 6=Domingo.
export function toUiDayOfWeek(dayOfWeek: number): number | null {
    if (dayOfWeek >= 1 && dayOfWeek <= 7) return dayOfWeek - 1;
    if (dayOfWeek >= 0 && dayOfWeek <= 6) return dayOfWeek;
    return null;
}

// Persist canonical DB mapping to avoid shifts between screens.
export function toDbDayOfWeek(uiDayIndex: number): number {
    return uiDayIndex + 1;
}

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
    anamnesis: 'Anamnesis',
    exploration: 'Exploracion',
    evolution: 'Evolucion',
    report: 'Informe',
};

export const RECORD_TYPE_COLORS: Record<RecordType, string> = {
    anamnesis: '#6B8FAD',
    exploration: '#9B8BB4',
    evolution: '#7C9A6B',
    report: '#C06B4E',
};

export const PATIENT_DOCUMENT_TYPE_LABELS: Record<PatientDocumentType, string> = {
    clinical_history: 'Historia clínica fisioterapéutica',
    intervention_consent: 'Consentimiento de intervención',
    data_consent: 'Consentimiento LOPD/RGPD',
};

export const PATIENT_DOCUMENT_STATUS_LABELS: Record<PatientDocumentStatus, string> = {
    draft: 'Borrador',
    completed: 'Completado',
    signed: 'Firmado',
};

export interface Payment {
    id: string;
    appointment_id: string;
    patient_id: string;
    amount: number;
    method: PaymentMethod;
    paid_at: string;
    notes: string | null;
    receipt_number: string;
    created_by: string | null;
    created_at: string;
    // Joined
    appointment?: Appointment;
    patient?: Patient;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    bizum: 'Bizum',
    transfer: 'Transferencia',
    other: 'Otro',
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    completed: 'Completada',
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
    pending: '#f59e0b',
    confirmed: '#10b981',
    cancelled: '#ef4444',
    completed: '#6366f1',
};
