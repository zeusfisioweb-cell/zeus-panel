import { useMemo } from 'react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, startOfISOWeek } from 'date-fns';
import type { Appointment } from '@/lib/types';

interface UseCalendarCalculationsProps {
    openHour: number;
    closeHour: number;
    calMonth: Date;
    calViewMode: 'list' | 'day' | 'week';
    selectedDate: Date;
    appointments: Appointment[];
    profId?: string;
    filter: string;
    dateFilter: string;
    searchTerm: string;
}

export function useCalendarCalculations({
    openHour,
    closeHour,
    calMonth,
    calViewMode,
    selectedDate,
    appointments,
    profId,
    filter,
    dateFilter,
    searchTerm
}: UseCalendarCalculationsProps) {
    // Timeline variables
    const HOURS = useMemo(() => {
        const length = closeHour - openHour + 1;
        return Array.from({ length: length > 0 ? length : 14 }, (_, i) => i + openHour);
    }, [openHour, closeHour]);

    // Derived State: Mini Calendar
    const miniCalDays = useMemo(() => {
        const monthS = startOfMonth(calMonth);
        const monthE = endOfMonth(calMonth);
        const calStart = startOfWeek(monthS, { weekStartsOn: 1 });
        const calEnd = endOfWeek(monthE, { weekStartsOn: 1 });
        const days: Date[] = [];
        let d = calStart;
        while (d <= calEnd) {
            days.push(d);
            d = addDays(d, 1);
        }
        return days;
    }, [calMonth]);

    const aptsByDay = useMemo(() => {
        const map: Record<string, number> = {};
        appointments.forEach(a => {
            if (a.status === 'cancelled') return;
            if (profId && a.professional_id !== profId) return;

            const key = new Date(a.start_time).toISOString().split('T')[0];
            map[key] = (map[key] || 0) + 1;
        });
        return map;
    }, [appointments, profId]);

    // Derived State: Calendar View
    const visibleDays = useMemo(() => {
        if (calViewMode === 'day') return [selectedDate];
        const weekStart = startOfISOWeek(selectedDate);
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }, [selectedDate, calViewMode]);

    const dayAppointments = useMemo(() => {
        const map = new Map<string, Appointment[]>();
        appointments.forEach(a => {
            if (profId && a.professional_id !== profId) return;
            const key = new Date(a.start_time).toISOString().split('T')[0];
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(a);
        });
        // Sort each day's appointments
        map.forEach((apts) => {
            apts.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
        });
        return map;
    }, [appointments, profId]);

    const getDay = (day: Date) => dayAppointments.get(day.toISOString().split('T')[0]) || [];

    // Derived State: List View
    const filteredAppointments = useMemo(() => {
        return appointments.filter(apt => {
            if (profId && apt.professional_id !== profId) return false;

            if (filter !== 'all') {
                if (filter === 'upcoming') {
                    if (apt.status === 'cancelled' || apt.status === 'completed') return false;
                } else if (apt.status !== filter) {
                    return false;
                }
            }
            if (dateFilter) {
                if (!apt.start_time.startsWith(dateFilter)) return false;
            }
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchName = apt.patient_name?.toLowerCase().includes(term);
                // patient may or may not be strongly typed on UI, safe cast
                const patientDocId = (apt as any).patient?.document_id || '';
                const matchDoc = patientDocId.toLowerCase().includes(term);
                if (!matchName && !matchDoc) return false;
            }
            return true;
        }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }, [appointments, filter, dateFilter, searchTerm, profId]);

    return {
        HOURS,
        miniCalDays,
        aptsByDay,
        visibleDays,
        dayAppointments,
        getDay,
        filteredAppointments
    };
}
