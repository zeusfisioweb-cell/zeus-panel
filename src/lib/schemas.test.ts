import { describe, expect, it } from 'vitest';
import { PaymentSchema, ProfessionalCreateSchema, validateData } from '@/lib/schemas';

describe('validateData', () => {
    it('returns parsed data for a valid professional payload', () => {
        const result = validateData(ProfessionalCreateSchema, {
            email: 'doctor@example.com',
            full_name: 'Doctor One',
            specialty: null,
            bio: 'Specialist in family medicine',
            color_code: null,
            is_active: false,
            service_ids: ['service-1', 'service-2'],
            schedule_slots: [
                {
                    day_of_week: 1,
                    start_time: '09:00',
                    end_time: '14:00',
                },
            ],
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.email).toBe('doctor@example.com');
            expect(result.data.full_name).toBe('Doctor One');
            expect(result.data.specialty).toBeNull();
            expect(result.data.bio).toBe('Specialist in family medicine');
            expect(result.data.color_code).toBeNull();
            expect(result.data.is_active).toBe(false);
            expect(result.data.service_ids).toEqual(['service-1', 'service-2']);
            expect(result.data.schedule_slots).toEqual([
                {
                    day_of_week: 1,
                    start_time: '09:00',
                    end_time: '14:00',
                },
            ]);
        }
    });

    it('returns field errors for an invalid professional payload', () => {
        const result = validateData(ProfessionalCreateSchema, {
            email: 'not-an-email',
            full_name: 'Dr',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors.email).toBeDefined();
            expect(result.errors.full_name).toBeDefined();
            expect(result.errors.service_ids).toBeDefined();
        }
    });
});

describe('PaymentSchema', () => {
    const validPayload = {
        appointment_id: '11111111-1111-1111-1111-111111111111',
        amount: 40,
        method: 'cash' as const,
    };

    it('accepts a minimal valid payload', () => {
        const result = PaymentSchema.safeParse(validPayload);
        expect(result.success).toBe(true);
    });

    it('coerces string amounts to numbers', () => {
        const result = PaymentSchema.safeParse({ ...validPayload, amount: '35.50' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.amount).toBe(35.5);
    });

    it('rejects negative or zero amounts', () => {
        expect(PaymentSchema.safeParse({ ...validPayload, amount: 0 }).success).toBe(false);
        expect(PaymentSchema.safeParse({ ...validPayload, amount: -10 }).success).toBe(false);
    });

    it('rejects amounts above the cap', () => {
        const result = PaymentSchema.safeParse({ ...validPayload, amount: 100000 });
        expect(result.success).toBe(false);
    });

    it('rejects unknown payment methods', () => {
        const result = PaymentSchema.safeParse({ ...validPayload, method: 'paypal' });
        expect(result.success).toBe(false);
    });

    it('rejects malformed appointment_id', () => {
        const result = PaymentSchema.safeParse({ ...validPayload, appointment_id: 'not-a-uuid' });
        expect(result.success).toBe(false);
    });

    it('accepts optional ISO paid_at and trims trailing notes', () => {
        const result = PaymentSchema.safeParse({
            ...validPayload,
            paid_at: '2026-05-20T15:30:00.000Z',
            notes: 'Cobro en efectivo',
        });
        expect(result.success).toBe(true);
    });

    it('rejects notes longer than 500 chars', () => {
        const result = PaymentSchema.safeParse({ ...validPayload, notes: 'a'.repeat(501) });
        expect(result.success).toBe(false);
    });
});
