import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

const ApiRouteErrorMock = vi.hoisted(() => class ApiRouteError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
});

const ensurePatientAccessMock = vi.hoisted(() => vi.fn());
const requirePanelAccessMock = vi.hoisted(() => vi.fn());
const resolveScopedProfessionalIdMock = vi.hoisted(() =>
    vi.fn((role: string, professionalId: string | null) => (role === 'professional' ? professionalId : null))
);
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock('../../_lib', () => ({
    ApiRouteError: ApiRouteErrorMock,
    ensurePatientAccess: ensurePatientAccessMock,
        requirePanelAccess: requirePanelAccessMock,
    assertSameOriginMutation: vi.fn(),
    resolveScopedProfessionalId: resolveScopedProfessionalIdMock,
    writeAuditLog: writeAuditLogMock,
    handleApiError: (error: unknown) => {
        if (error instanceof ApiRouteErrorMock) {
            return Response.json({ error: error.message }, { status: error.status });
        }

        return Response.json({ error: 'Internal Server Error' }, { status: 500 });
    },
}));

describe('admin clinical record delete RBAC', () => {
    beforeEach(() => {
        ensurePatientAccessMock.mockReset();
        requirePanelAccessMock.mockReset();
        resolveScopedProfessionalIdMock.mockClear();
        writeAuditLogMock.mockReset();
    });

    it('blocks a professional from deleting another professional clinical record', async () => {
        const deleteRecord = vi.fn().mockReturnThis();
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                patient_id: '11111111-1111-1111-1111-111111111111',
                professional_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            },
            error: null,
        });
        const recordQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle,
            delete: deleteRecord,
        };
        const supabase = {
            from: vi.fn().mockReturnValue(recordQuery),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            professionalId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await DELETE(
            new Request('http://localhost/api/admin/clinical-records/record-1'),
            { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ error: 'Forbidden' });
        expect(deleteRecord).not.toHaveBeenCalled();
    });

    it('owner deletes a clinical record and writes audit log', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                patient_id: '11111111-1111-1111-1111-111111111111',
                professional_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            },
            error: null,
        });
        let callCount = 0;
        const supabase = {
            from: vi.fn(() => {
                callCount++;
                if (callCount === 1) {
                    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle };
                }
                return { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) };
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'owner',
            userId: 'owner-1',
            professionalId: null,
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await DELETE(
            new Request('http://localhost/api/admin/clinical-records/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
            { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'DELETE',
            tableName: 'clinical_records',
            recordId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        }));
    });

    it('professional deletes own clinical record successfully', async () => {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: {
                id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                patient_id: '11111111-1111-1111-1111-111111111111',
                professional_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            },
            error: null,
        });
        const recordQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle,
        };
        const deleteEq = vi.fn().mockReturnThis();
        const deleteQuery = {
            delete: vi.fn().mockReturnThis(),
            eq: deleteEq,
            error: undefined,
        };
        let callCount = 0;
        const supabase = {
            from: vi.fn(() => {
                callCount++;
                if (callCount === 1) return recordQuery;
                return deleteQuery;
            }),
        };

        requirePanelAccessMock.mockResolvedValue({
            supabase,
            role: 'professional',
            userId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            professionalId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        });
        ensurePatientAccessMock.mockResolvedValue(undefined);

        const response = await DELETE(
            new Request('http://localhost/api/admin/clinical-records/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
            { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({ success: true });
        expect(deleteEq).toHaveBeenCalledWith('id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
        expect(deleteEq).toHaveBeenCalledWith('professional_id', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
        expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
            action: 'DELETE',
            tableName: 'clinical_records',
            recordId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        }));
    });
});
