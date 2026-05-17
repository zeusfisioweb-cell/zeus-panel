const PORTAL_URL = process.env.PORTAL_URL ?? '';
const CLINIC_NAME = process.env.CLINIC_NAME ?? 'Zeus Fisioterapia';

if (!process.env.PORTAL_URL) {
    console.warn('[whatsapp] PORTAL_URL not configured — portal link will be omitted from messages');
}

export interface AppointmentWhatsAppParams {
    patientName: string;
    patientPhone: string;
    serviceName: string;
    professionalName: string;
    startTime: string;
    isReschedule: boolean;
}

export function _formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('34') && digits.length === 11) return digits;
    if (digits.startsWith('0034') && digits.length === 13) return digits.slice(2);
    if (!digits.startsWith('34') && digits.length === 9) return `34${digits}`;
    return digits;
}

export function _formatDate(isoString: string): string {
    const d = new Date(isoString);
    const opts: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Madrid',
    };
    const parts = new Intl.DateTimeFormat('es-ES', opts).formatToParts(d);
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    const hour = parts.find(p => p.type === 'hour')?.value ?? '';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '';
    return `${weekday} ${day} de ${month} a las ${hour}:${minute}`;
}

export function _escapeWaText(str: string): string {
    return str.replace(/[_*~`]/g, '\\$&');
}

export function _maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 5) return '***';
    return digits.slice(0, -4).replace(/\d/g, '*') + digits.slice(-4);
}

export async function sendAppointmentWhatsApp(params: AppointmentWhatsAppParams): Promise<void> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
        if (process.env.NODE_ENV !== 'production') {
            console.log('[whatsapp:dev]', params.isReschedule ? 'Appointment rescheduled' : 'Appointment confirmed', {
                phone: _maskPhone(params.patientPhone),
                service: params.serviceName,
                date: _formatDate(params.startTime),
            });
        } else {
            console.warn('[whatsapp] WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID not configured — message not sent');
        }
        return;
    }

    const to = _formatPhone(params.patientPhone);
    const dateStr = _formatDate(params.startTime);

    const portalSuffix = PORTAL_URL ? `\n\nGestiona tus citas: ${PORTAL_URL}` : '';
    const body = params.isReschedule
        ? `${CLINIC_NAME}: Tu cita de ${_escapeWaText(params.serviceName)} con ${_escapeWaText(params.professionalName)} se ha movido al ${dateStr}.${portalSuffix}`
        : `${CLINIC_NAME}: Tu cita de ${_escapeWaText(params.serviceName)} con ${_escapeWaText(params.professionalName)} el ${dateStr} está confirmada.${portalSuffix}`;

    try {
        const res = await fetch(
            `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    to,
                    type: 'text',
                    text: { preview_url: false, body },
                }),
            }
        );

        const json = await res.json().catch(() => null);

        if (!res.ok) {
            console.error('[whatsapp] Failed to send message:', {
                status: res.status,
                body: json,
                to: _maskPhone(to),
            });
        }
    } catch {
        console.error('[whatsapp] Error sending to', _maskPhone(to));
    }
}
