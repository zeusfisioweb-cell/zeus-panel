// Shared utility functions for the Zeus panel

const AVATAR_COLORS = [
    '#AD7332', '#C9954D', '#8B5A26', '#7A4E1E', '#A8654A',
    '#9F662A', '#73563A', '#B07B5A', '#6F7A4F', '#8C6A54',
];

/** Generate a consistent avatar color based on a name string */
export function getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Get initials from a full name (max 2 chars) */
export function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Check if two dates are the same calendar day */
export function isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

/** Format a date to a short time string (HH:MM) */
export function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}
