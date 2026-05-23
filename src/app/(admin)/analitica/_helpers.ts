export const PIE_COLORS = ['#AD7332', '#C9954D', '#2563EB', '#059669', '#D97706', '#0F766E', '#8B5A26', '#64748B'];

export const EMPTY_CLASSES =
    'flex items-center justify-center h-[200px] text-[var(--text-muted)] text-[13px] font-semibold';

export function pillClasses(active: boolean): string {
    return `py-1.5 px-3 text-[13px] font-semibold rounded-md cursor-pointer whitespace-nowrap ${
        active
            ? 'bg-[var(--bg-surface)] text-[var(--text-main)] border border-[var(--border-color)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
            : 'bg-transparent text-[var(--text-muted)] border border-transparent'
    }`;
}

export function occPillClasses(active: boolean): string {
    return `py-1 px-2 text-[11px] font-semibold rounded-md border cursor-pointer ${
        active
            ? 'bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border-color)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
            : 'bg-transparent text-[var(--text-muted)] border-transparent'
    }`;
}
