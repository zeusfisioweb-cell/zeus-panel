const INJECTION_PREFIX_REGEX = /^[=+\-@\t\r]/;

/**
 * Escapes a single CSV cell value.
 * - Null/undefined → empty string
 * - Cells containing commas, quotes, or newlines are wrapped in double-quotes
 * - Internal double-quotes are doubled
 * - Values starting with injection prefixes (=, +, -, @) are prefixed with '
 */
export function escapeCsvCell(value: unknown): string {
    if (value === null || value === undefined) return '';

    let str = String(value);

    if (INJECTION_PREFIX_REGEX.test(str)) {
        str = `'${str}`;
    }

    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        str = `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}

/**
 * Converts headers + rows into a CSV string with CRLF line endings (Excel-compatible).
 */
export function rowsToCsv(headers: string[], rows: unknown[][]): string {
    const lines: string[] = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map(row => row.map(escapeCsvCell).join(',')),
    ];
    return lines.join('\r\n');
}

export interface CsvSection {
    title: string;
    headers: string[];
    rows: unknown[][];
}

/**
 * Builds a multi-section CSV. Each section has a title row, then headers, then data.
 * Sections are separated by a blank line.
 */
export function buildMultiSectionCsv(sections: CsvSection[]): string {
    return sections
        .map(({ title, headers, rows }) => {
            const titleRow = escapeCsvCell(title);
            const body = rowsToCsv(headers, rows);
            return `${titleRow}\r\n${body}`;
        })
        .join('\r\n\r\n');
}
