import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const ApiRouteErrorMock = vi.hoisted(
    () =>
        class ApiRouteError extends Error {
            status: number;

            constructor(status: number, message: string) {
                super(message);
                this.status = status;
            }
        }
);

const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin patient export route', () => {
    beforeEach(() => {
        requirePanelAccessMock.mockReset();
        writeAuditLogMock.mockReset();
    });

    it('exports patient data and writes view audit log', async () => {
        const patientLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: {
                    id: '11111111-1111-1111-1111-111111111111',
                    first_name: 'Ana',
                    last_name: 'Lopez',
                    email: 'ana@example.com',
                    phone: '600000000',
                    document_id: '123',
                    birth_date: '1990-01-01',
                    address: 'Main St',
                    gdpr_consent: true,
                    marketing_consent: false,
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-02T00:00:00.000Z',
                    deleted_at: null,
                },
                error: null,
            }),
        };
        const appointmentsLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [
                    {
                        start_time: '2026-04-03T09:00:00.000Z',
                        end_time: '2026-04-03T10:00:00.000Z',
                        status: 'confirmed',
                        notes: 'Seguimiento',
                        service: { name: 'Fisioterapia' },
                        professional: { profile: { full_name: 'Pro Uno' } },
                    },
                ],
                error: null,
            }),
        };
        const clinicalLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
        };
        const consentLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
        };
        const auditLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
        };

        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'patients') return patientLookup;
                if (table === 'appointments') return appointmentsLookup;
                if (table === 'clinical_records') return clinicalLookup;
                if (table === 'consent_records') return consentLookup;
                if (table === 'audit_logs') return auditLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await GET(
            new Request('http://localhost/api/admin/patients/patient-1/export'),
            { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
        );
        const body = JSON.parse(await response.text()) as {
            personal_data: { first_name: string };
            export_metadata: { format_version: string };
            appointments: Array<{ professional: { profile: { full_name: string } } }>;
        };

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Disposition')).toContain('patient_11111111-1111-1111-1111-111111111111_gdpr_export.json');
        expect(response.headers.get('Cache-Control')).toBe('no-store, private, max-age=0');
        expect(response.headers.get('Pragma')).toBe('no-cache');
        expect(response.headers.get('Expires')).toBe('0');
        expect(body.personal_data.first_name).toBe('Ana');
        expect(body.export_metadata.format_version).toBe('1.0');
        expect(body.appointments[0]?.professional?.profile?.full_name).toBe('Pro Uno');
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner-1',
                action: 'VIEW',
                tableName: 'patients',
                recordId: '11111111-1111-1111-1111-111111111111',
            })
        );
    });

    it('returns 404 when patient does not exist', async () => {
        const patientLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'not found' },
            }),
        };
        const supabase = {
            from: vi.fn(() => patientLookup),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await GET(
            new Request('http://localhost/api/admin/patients/patient-1/export'),
            { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toEqual({ error: 'Patient not found' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('returns 500 when related data query fails', async () => {
        const patientLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
                data: {
                    id: '11111111-1111-1111-1111-111111111111',
                    first_name: 'Ana',
                    last_name: 'Lopez',
                },
                error: null,
            }),
        };
        const appointmentsLookup = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'appointments failed' },
            }),
        };
        const supabase = {
            from: vi.fn((table: string) => {
                if (table === 'patients') return patientLookup;
                if (table === 'appointments') return appointmentsLookup;
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            userId: 'owner-1',
        });

        const response = await GET(
            new Request('http://localhost/api/admin/patients/patient-1/export'),
            { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'Internal Server Error' });
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });
});
