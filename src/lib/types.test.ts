import { describe, expect, it } from 'vitest';
import { toDbDayOfWeek, toUiDayOfWeek } from '@/lib/types';

describe('day of week mappings', () => {
    it('maps canonical database days to ui indices', () => {
        expect(toUiDayOfWeek(1)).toBe(0);
        expect(toUiDayOfWeek(4)).toBe(3);
        expect(toUiDayOfWeek(7)).toBe(6);
    });

    it('keeps zero as a backward-compatible legacy value', () => {
        expect(toUiDayOfWeek(0)).toBe(0);
    });

    it('rejects out-of-range values', () => {
        expect(toUiDayOfWeek(-1)).toBeNull();
        expect(toUiDayOfWeek(8)).toBeNull();
    });

    it('maps ui indices back to canonical database days', () => {
        expect(toDbDayOfWeek(0)).toBe(1);
        expect(toDbDayOfWeek(3)).toBe(4);
        expect(toDbDayOfWeek(6)).toBe(7);
    });
});
