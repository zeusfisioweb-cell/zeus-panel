// Database types for the Zeus appointment system

export type UserRole = 'owner' | 'professional' | 'client';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type RecordType = 'anamnesis' | 'exploration' | 'evolution' | 'report';
export type ConsentType = 'gdpr' | 'informed' | 'marketing';
export type AppointmentSource = 'web' | 'admin' | 'phone';

export interface Profile {
    id: string;
    email: string;
    role: UserRole;
    full_name: string | null;
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
    created_at: string;
    updated_at: string;
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

export interface BookingSettings {
    id: string;
    clinic_name: string;
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
    updated_at: string;
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

// Day names for schedule display
export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

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
