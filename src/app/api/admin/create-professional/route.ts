import { NextResponse } from 'next/server';
import { ProfessionalCreateSchema, validateData } from '@/lib/schemas';
import { assertSameOriginMutation, getAdminSupabase, handleApiError, requirePanelAccess, writeAuditLog } from '../_lib';
import { checkRateLimit, getRetryAfterSeconds, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit';

export async function POST(request: Request) {
    try {
        assertSameOriginMutation(request);
        const { supabase, userId: ownerUserId } = await requirePanelAccess({ ownerOnly: true });

        const { success, reset } = await checkRateLimit(ownerUserId, 'create-professional', 10, 3600);
        if (!success) {
            return NextResponse.json(
                { error: RATE_LIMIT_MESSAGE },
                { status: 429, headers: { 'Retry-After': String(getRetryAfterSeconds(reset)) } }
            );
        }

        const adminAuthClient = getAdminSupabase();

        // Validate request body
        const rawBody = await request.json();
        const validation = validateData(ProfessionalCreateSchema, rawBody);
        
        if (!validation.success) {
            return NextResponse.json({ error: 'Validación fallida', details: validation.errors }, { status: 400 });
        }

        const {
            email,
            full_name,
            specialty,
            bio,
            color_code,
            is_active,
            service_ids,
            schedule_slots,
        } = validation.data;

        // Generate a secure temporary password server-side.
        // Never accept temp_password from the client to avoid exposure over the network.
        const tempPassword = `${crypto.randomUUID()}-${crypto.randomUUID()}`.slice(0, 32);

        const normalizedFullName = full_name.trim();

        // 1. Create the user in auth.users
        const { data: authData, error: authError } = await adminAuthClient.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: true, // Auto confirm so they can log in
            user_metadata: {
                full_name: normalizedFullName,
            }
        });

        if (authError || !authData.user) {
            console.error('Error creating auth user:', authError);
            const isEmailTaken = authError?.message?.toLowerCase().includes('already registered')
                || authError?.message?.toLowerCase().includes('already been registered');
            return NextResponse.json(
                { error: isEmailTaken ? 'El correo ya está registrado' : 'Error al crear el usuario' },
                { status: isEmailTaken ? 409 : 500 }
            );
        }

        const userId = authData.user.id;

        // 2. Ensure profile exists with professional role
        const { error: profileError } = await adminAuthClient
            .from('profiles')
            .upsert({
                id: userId,
                email: email,
                role: 'professional',
                full_name: normalizedFullName,
            });

        if (profileError) {
            console.error('Error creating profile, rolling back auth user:', profileError);
            await adminAuthClient.auth.admin.deleteUser(userId);
            return NextResponse.json({ error: 'Error al crear el perfil del profesional' }, { status: 500 });
        }

        // 3. Create professional record
        const { error: professionalError } = await adminAuthClient
            .from('professionals')
            .upsert({
                id: userId,
                user_id: userId,
                specialty: specialty || null,
                bio: bio || null,
                color_code: color_code || '#AD7332',
                is_active: is_active ?? true,
            });

        if (professionalError) {
            console.error('Error creating professional, rolling back auth user:', professionalError);
            await adminAuthClient.auth.admin.deleteUser(userId);
            return NextResponse.json({ error: 'Error al crear el profesional' }, { status: 500 });
        }

        // 4. Create professional-service links when provided
        if (service_ids && service_ids.length > 0) {
            const serviceRows = service_ids.map((serviceId) => ({
                professional_id: userId,
                service_id: serviceId,
            }));

            const { error: serviceLinksError } = await adminAuthClient
                .from('professional_services')
                .insert(serviceRows);

            if (serviceLinksError) {
                console.error('Error creating professional services, rolling back auth user:', serviceLinksError);
                await adminAuthClient.auth.admin.deleteUser(userId);
                return NextResponse.json({ error: 'Error al asociar servicios al profesional' }, { status: 500 });
            }
        }

        // 5. Create schedule slots when provided
        if (schedule_slots && schedule_slots.length > 0) {
            const slotRows = schedule_slots.map((slot) => ({
                professional_id: userId,
                day_of_week: slot.day_of_week,
                start_time: slot.start_time,
                end_time: slot.end_time,
            }));

            const { error: scheduleError } = await adminAuthClient
                .from('schedule_slots')
                .insert(slotRows);

            if (scheduleError) {
                console.error('Error creating schedule slots, rolling back auth user:', scheduleError);
                await adminAuthClient.auth.admin.deleteUser(userId);
                return NextResponse.json({ error: 'Error al crear el horario del profesional' }, { status: 500 });
            }
        }

        await writeAuditLog({
            supabase,
            userId: ownerUserId,
            action: 'CREATE',
            tableName: 'professionals',
            recordId: userId,
            details: { email, service_count: service_ids.length },
        });

        return NextResponse.json({ success: true, user_id: userId });

    } catch (error: unknown) {
        console.error('Error in create-professional API:', error);
        return handleApiError(error);
    }
}
