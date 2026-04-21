import { describe, it, expect } from 'vitest';
import { escapeCsvCell, rowsToCsv, buildMultiSectionCsv } from './csv';

describe('escapeCsvCell', () => {
    it('returns empty string for null', () => {
        expect(escapeCsvCell(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(escapeCsvCell(undefined)).toBe('');
    });

    it('returns plain string unchanged', () => {
        expect(escapeCsvCell('hello')).toBe('hello');
    });

    it('wraps in quotes when value contains comma', () => {
        expect(escapeCsvCell('hello, world')).toBe('"hello, world"');
    });

    it('doubles internal quotes and wraps', () => {
        expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    });

    it('wraps in quotes when value contains newline', () => {
        expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    });

    it('prefixes = with single quote to prevent injection', () => {
        expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    });

    it('prefixes + with single quote', () => {
        expect(escapeCsvCell('+cmd')).toBe("'+cmd");
    });

    it('prefixes @ with single quote', () => {
        expect(escapeCsvCell('@user')).toBe("'@user");
    });

    it('converts numbers to string', () => {
        expect(escapeCsvCell(42)).toBe('42');
    });
});

describe('rowsToCsv', () => {
    it('produces header + data rows with CRLF', () => {
        const result = rowsToCsv(['Name', 'Age'], [['Alice', '30'], ['Bob', '25']]);
        expect(result).toBe('Name,Age\r\nAlice,30\r\nBob,25');
    });

    it('handles empty rows array', () => {
        expect(rowsToCsv(['Name'], [])).toBe('Name');
    });
});

describe('buildMultiSectionCsv', () => {
    it('emits title row before headers', () => {
        const result = buildMultiSectionCsv([
            { title: 'Patients', headers: ['Name'], rows: [['Alice']] },
        ]);
        expect(result).toContain('Patients\r\nName\r\nAlice');
    });

    it('separates sections with blank line', () => {
        const result = buildMultiSectionCsv([
            { title: 'A', headers: ['x'], rows: [['1']] },
            { title: 'B', headers: ['y'], rows: [['2']] },
        ]);
        expect(result).toContain('\r\n\r\n');
        expect(result.indexOf('A')).toBeLessThan(result.indexOf('B'));
    });

    it('emits section header even when rows are empty', () => {
        const result = buildMultiSectionCsv([
            { title: 'Appointments', headers: ['Date', 'Service'], rows: [] },
        ]);
        expect(result).toContain('Appointments\r\nDate,Service');
    });
});
