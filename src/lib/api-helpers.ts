export async function readApiError(response: Response): Promise<string> {
    try {
        const body = (await response.json()) as { error?: string; details?: Record<string, string[]> };
        if (body.details) {
            const firstField = Object.values(body.details).flat()[0];
            if (firstField) return firstField;
        }
        return body.error ?? `Error del servidor (${response.status})`;
    } catch {
        return response.ok ? 'Error desconocido' : `Error del servidor (${response.status})`;
    }
}
