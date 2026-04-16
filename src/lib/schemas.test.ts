import { describe, expect, it } from 'vitest';
import { ProfessionalCreateSchema, validateData } from '@/lib/schemas';

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
