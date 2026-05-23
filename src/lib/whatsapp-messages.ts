export const PORTAL_URL =
    process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://zeusfisioterapiatorrijos.com/portal/mis-citas';

const CLINIC_NAME = 'Zeus Fisioterapia';

export interface WaMessageParams {
    patientName: string | null | undefined;
    serviceName: string | undefined;
    /** Pre-formatted time string, e.g. "10:30" */
    time: string;
    /** Optional date label (e.g. "mañana", "el viernes 24"). Defaults to "hoy". */
    dateLabel?: string;
}

export function buildWaLink(text: string, phone: string | null | undefined): string {
    const digits = (phone ?? '').replace(/\D/g, '');
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function resolveName(name: string | null | undefined): string {
    const trimmed = (name ?? '').trim();
    return trimmed || 'paciente';
}

function resolveService(service: string | undefined): string {
    return service?.trim() || 'tu sesión';
}

export function confirmMessage({ patientName, serviceName, time, dateLabel = 'hoy' }: WaMessageParams): string {
    return `Hola ${resolveName(patientName)}, te escribimos desde ${CLINIC_NAME} para confirmar tu cita de ${resolveService(serviceName)} ${dateLabel} a las ${time}.\n\nPuedes ver o gestionar tu cita en el portal: ${PORTAL_URL}`;
}

export function reminderMessage({ patientName, serviceName, time, dateLabel = 'hoy' }: WaMessageParams): string {
    return `Hola ${resolveName(patientName)}, te recordamos tu cita en ${CLINIC_NAME}: ${resolveService(serviceName)} ${dateLabel} a las ${time}. ¡Te esperamos!\n\nConsulta los detalles de tu cita en el portal: ${PORTAL_URL}`;
}

export function feedbackMessage({ patientName, serviceName }: WaMessageParams): string {
    return `Hola ${resolveName(patientName)}, gracias por venir a tu ${resolveService(serviceName)} en ${CLINIC_NAME}. Si puedes, déjanos una reseña en Google. ¡Nos ayuda mucho!\n\nGestiona tus próximas citas en el portal: ${PORTAL_URL}`;
}
