import { describe, it, expect } from 'vitest';
import {
    isAlignedToInterval,
    doIntervalsOverlapWithBuffer,
    findConflict,
    computeCancellationDeadline,
    canCancel,
    type AppointmentSlot,
} from './booking-validation';

describe('isAlignedToInterval', () => {
    it('returns true for exact 30-min boundary', () => {
        expect(isAlignedToInterval('2024-01-01T10:00:00.000Z', 30)).toBe(true);
    });

    it('returns true for exact 15-min boundary', () => {
        expect(isAlignedToInterval('2024-01-01T10:15:00.000Z', 15)).toBe(true);
    });

    it('returns false for misaligned time', () => {
        expect(isAlignedToInterval('2024-01-01T10:05:00.000Z', 30)).toBe(false);
    });

    it('returns true for midnight (0 min from anchor)', () => {
        expect(isAlignedToInterval('2024-01-01T00:00:00.000Z', 30)).toBe(true);
    });

    it('returns true when intervalMinutes is 0 (no restriction)', () => {
        expect(isAlignedToInterval('2024-01-01T10:07:00.000Z', 0)).toBe(true);
    });
});

describe('doIntervalsOverlapWithBuffer', () => {
    const toMs = (iso: string) => new Date(iso).getTime();

    it('returns false for non-overlapping intervals without buffer', () => {
        expect(doIntervalsOverlapWithBuffer(
            toMs('2024-01-01T10:00:00Z'), toMs('2024-01-01T11:00:00Z'),
            toMs('2024-01-01T11:00:00Z'), toMs('2024-01-01T12:00:00Z'),
            0
        )).toBe(false);
    });

    it('returns true when buffer pushes adjacent intervals into overlap', () => {
        expect(doIntervalsOverlapWithBuffer(
            toMs('2024-01-01T10:00:00Z'), toMs('2024-01-01T11:00:00Z'),
            toMs('2024-01-01T11:00:00Z'), toMs('2024-01-01T12:00:00Z'),
            10 * 60 * 1000
        )).toBe(true);
    });

    it('returns true for directly overlapping intervals', () => {
        expect(doIntervalsOverlapWithBuffer(
            toMs('2024-01-01T10:00:00Z'), toMs('2024-01-01T11:00:00Z'),
            toMs('2024-01-01T10:30:00Z'), toMs('2024-01-01T11:30:00Z'),
            0
        )).toBe(true);
    });
});

describe('findConflict', () => {
    const slot = (id: string, start: string, end: string, status = 'confirmed'): AppointmentSlot => ({
        id, start_time: start, end_time: end, status,
    });

    const candidateStart = new Date('2024-01-01T10:00:00Z').getTime();
    const candidateEnd = new Date('2024-01-01T11:00:00Z').getTime();

    it('returns null when no existing appointments', () => {
        expect(findConflict(candidateStart, candidateEnd, 0, [])).toBeNull();
    });

    it('returns conflicting slot when times overlap', () => {
        const existing = [slot('a', '2024-01-01T10:30:00Z', '2024-01-01T11:30:00Z')];
        expect(findConflict(candidateStart, candidateEnd, 0, existing)?.id).toBe('a');
    });

    it('ignores cancelled appointments', () => {
        const existing = [slot('a', '2024-01-01T10:30:00Z', '2024-01-01T11:30:00Z', 'cancelled')];
        expect(findConflict(candidateStart, candidateEnd, 0, existing)).toBeNull();
    });

    it('excludes the appointment being rescheduled via excludeId', () => {
        const existing = [slot('self', '2024-01-01T10:00:00Z', '2024-01-01T11:00:00Z')];
        expect(findConflict(candidateStart, candidateEnd, 0, existing, 'self')).toBeNull();
    });

    it('detects conflict via buffer when intervals are adjacent', () => {
        const existing = [slot('b', '2024-01-01T11:00:00Z', '2024-01-01T12:00:00Z')];
        expect(findConflict(candidateStart, candidateEnd, 15, existing)?.id).toBe('b');
    });

    it('returns null when intervals are far enough apart with buffer', () => {
        const existing = [slot('c', '2024-01-01T11:30:00Z', '2024-01-01T12:30:00Z')];
        expect(findConflict(candidateStart, candidateEnd, 15, existing)).toBeNull();
    });
});

describe('computeCancellationDeadline', () => {
    it('returns 24h before appointment start', () => {
        const deadline = computeCancellationDeadline('2024-01-02T10:00:00Z', 24);
        expect(deadline.toISOString()).toBe('2024-01-01T10:00:00.000Z');
    });

    it('returns same time when cancellationHours is 0', () => {
        const deadline = computeCancellationDeadline('2024-01-02T10:00:00Z', 0);
        expect(deadline.toISOString()).toBe('2024-01-02T10:00:00.000Z');
    });
});

describe('canCancel', () => {
    it('returns true when now is well before deadline', () => {
        const now = new Date('2024-01-01T08:00:00Z');
        expect(canCancel(now, '2024-01-03T08:00:00Z', 24)).toBe(true);
    });

    it('returns false when now is past deadline', () => {
        const now = new Date('2024-01-02T09:00:00Z');
        expect(canCancel(now, '2024-01-02T09:30:00Z', 24)).toBe(false);
    });

    it('returns true exactly at deadline', () => {
        const now = new Date('2024-01-01T10:00:00Z');
        expect(canCancel(now, '2024-01-02T10:00:00Z', 24)).toBe(true);
    });
});
