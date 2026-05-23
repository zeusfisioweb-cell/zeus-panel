import { readApiError } from './api-helpers';

type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface ApiFetchOptions {
    method?: ApiMethod;
    body?: unknown;
    signal?: AbortSignal;
    headers?: Record<string, string>;
}

export async function apiFetch<T = unknown>(url: string, options: ApiFetchOptions = {}): Promise<T> {
    const { method = 'GET', body, signal, headers } = options;
    const hasBody = body !== undefined;
    const init: RequestInit = {
        method,
        credentials: 'same-origin',
        signal,
        headers: {
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
        },
        ...(hasBody ? { body: JSON.stringify(body) } : {}),
    };

    const response = await fetch(url, init);

    if (!response.ok) {
        throw new Error(await readApiError(response));
    }

    if (response.status === 204) {
        return undefined as T;
    }

    const text = await response.text();
    if (!text) return undefined as T;

    return JSON.parse(text) as T;
}

export function buildSearchParams(filters: Record<string, string | number | boolean | undefined | null>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue;
        params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}
