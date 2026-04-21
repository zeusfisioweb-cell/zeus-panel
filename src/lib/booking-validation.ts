export interface AppointmentSlot {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
}

/**
 * Checks that a UTC ISO timestamp aligns to a slot interval grid anchored at midnight UTC.
 * e.g. 10:00 UTC with 30-min interval → ok; 10:05 UTC → not ok.
 */
export function isAlignedToInterval(isoTimestamp: string, intervalMinutes: number): boolean {
    if (intervalMinutes <= 0) return true;
    const date = new Date(isoTimestamp);
    const minutesSinceMidnight = date.getUTCHours() * 60 + date.getUTCMinutes();
    return minutesSinceMidnight % intervalMinutes === 0;
}

/**
 * Returns true when [aStart, aEnd) and [bStart, bEnd) overlap after expanding
 * each interval by bufferMinutes on both sides.
 * All times in ms since epoch.
 */
export function doIntervalsOverlapWithBuffer(
    aStartMs: number,
    aEndMs: number,
    bStartMs: number,
    bEndMs: number,
    bufferMs: number
): boolean {
    const aFrom = aStartMs - bufferMs;
    const aTo = aEndMs + bufferMs;
    const bFrom = bStartMs - bufferMs;
    const bTo = bEndMs + bufferMs;
    return aFrom < bTo && aTo > bFrom;
}

/**
 * Returns the first conflicting appointment slot, or null if none.
 * Cancelled appointments are ignored.
 * Pass excludeId to skip the appointment being rescheduled.
 */
export function findConflict(
    candidateStartMs: number,
    candidateEndMs: number,
    bufferMinutes: number,
    existing: AppointmentSlot[],
    excludeId?: string
): AppointmentSlot | null {
    const bufferMs = bufferMinutes * 60 * 1000;

    for (const slot of existing) {
        if (slot.status === 'cancelled') continue;
        if (excludeId && slot.id === excludeId) continue;

        const slotStartMs = new Date(slot.start_time).getTime();
        const slotEndMs = new Date(slot.end_time).getTime();

        if (doIntervalsOverlapWithBuffer(candidateStartMs, candidateEndMs, slotStartMs, slotEndMs, bufferMs)) {
            return slot;
        }
    }

    return null;
}

/**
 * Returns the deadline before which a cancellation must be requested.
 */
export function computeCancellationDeadline(startTimeIso: string, cancellationHours: number): Date {
    const start = new Date(startTimeIso);
    return new Date(start.getTime() - cancellationHours * 60 * 60 * 1000);
}

/**
 * Returns true if a cancellation is still allowed at `now`.
 */
export function canCancel(now: Date, startTimeIso: string, cancellationHours: number): boolean {
    const deadline = computeCancellationDeadline(startTimeIso, cancellationHours);
    return now.getTime() <= deadline.getTime();
}
