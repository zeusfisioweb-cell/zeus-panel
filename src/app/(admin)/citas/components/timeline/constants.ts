import type { AppointmentStatus } from '@/lib/types';

export const PX_PER_MIN = 2.2;   // 13h × 60 × 2.2 = 1716px total height
export const SLOT_MIN = 30;
export const MIN_DUR_MIN = 30;
export const MAX_VISIBLE_COLS = 4;
export const TIME_W = 64;
export const UNASSIGNED_COLOR = '#94a3b8';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
};

export const PALETTE = [
    '#3b82f6',
    '#22c55e',
    '#f59e0b',
    '#a855f7',
    '#ec4899',
    '#14b8a6',
    '#ef4444',
    '#6366f1',
];
