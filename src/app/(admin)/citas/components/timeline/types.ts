import type { Appointment } from '@/lib/types';

export interface PositionedAppointment {
    appointment: Appointment;
    topPx: number;
    heightPx: number;
    leftPct: number;
    widthPct: number;
    profColor: string;
    profName: string;
}

export interface OverflowBadge {
    type: 'overflow';
    topPx: number;
    heightPx: number;
    count: number;
    appointments: Appointment[];
}

export type PositionedItem = PositionedAppointment | OverflowBadge;
