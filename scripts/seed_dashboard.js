import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
    console.log('🌱 Starting database seed for Zeus Dashboard...');

    try {
        // 1. SERVICES
        console.log('Fetching existing services...');
        let { data: currentServices } = await supabase.from('services').select('*');

        if (!currentServices || currentServices.length === 0) {
            console.log('Inserting new services...');
            const servicesData = [
                { name: 'Fisioterapia General', description: 'Tratamiento de lesiones neuromusculoesqueléticas', duration_minutes: 60, price: 50, is_active: true },
                { name: 'Masaje de Descarga', description: 'Masaje deportivo preventivo', duration_minutes: 45, price: 40, is_active: true },
                { name: 'Osteopatía', description: 'Terapia manual holística', duration_minutes: 60, price: 60, is_active: true },
                { name: 'Rehabilitación Post-op', description: 'Readaptación tras intervención quirúrgica', duration_minutes: 60, price: 55, is_active: true },
                { name: 'Valoración Inicial', description: 'Primera consulta técnica', duration_minutes: 30, price: 30, is_active: true }
            ];
            for (const s of servicesData) {
                const { data: exists } = await supabase.from('services').select('id').eq('name', s.name).maybeSingle();
                if (!exists) {
                    await supabase.from('services').insert(s);
                }
            }
            const { data: insertedServices } = await supabase.from('services').select('*');
            currentServices = insertedServices;
        }

        // 2. PROFESSIONALS AND PROFILES (mock)
        console.log('Fetching existing professionals...');
        let { data: currentProfessionals } = await supabase.from('professionals').select('*');
        const dummys = [
            { id: '11111111-1111-1111-1111-111111111111', first_name: 'Dr. Alejandro', last_name: 'Gómez', email: 'agomez@clinical.com', specialty: 'Fisioterapeuta' },
            { id: '22222222-2222-2222-2222-222222222222', first_name: 'Dra. María', last_name: 'Vargas', email: 'mvargas@clinical.com', specialty: 'Osteópata' }
        ];

        if (!currentProfessionals || currentProfessionals.length < 2) {
            console.log('Inserting mock professionals...');
            for (const p of dummys) {
                const { data: profExists } = await supabase.from('profiles').select('id').eq('id', p.id).maybeSingle();
                if (!profExists) {
                    await supabase.from('profiles').insert({ id: p.id, full_name: `${p.first_name} ${p.last_name}`, email: p.email, role: 'professional' });
                }

                const { data: profesExists } = await supabase.from('professionals').select('id').eq('id', p.id).maybeSingle();
                if (!profesExists) {
                    await supabase.from('professionals').insert({ id: p.id, first_name: p.first_name, last_name: p.last_name, email: p.email, specialty: p.specialty, is_active: true });
                }
            }
            const { data: freshProfs } = await supabase.from('professionals').select('*');
            currentProfessionals = freshProfs;
        }


        // 3. PATIENTS
        console.log('Fetching existing patients...');
        let { data: currentPatients } = await supabase.from('patients').select('*');

        if (!currentPatients || currentPatients.length < 5) {
            const patientsData = [
                { first_name: 'Carlos', last_name: 'Pérez', email: 'carlos.ptest@test.com', phone: '600111222', gdpr_consent: true },
                { first_name: 'Ana', last_name: 'Martínez', email: 'anam.ptest@test.com', phone: '611222333', gdpr_consent: false },
                { first_name: 'Luis', last_name: 'García', email: 'luisg.ptest@test.com', phone: '622333444', gdpr_consent: true },
                { first_name: 'Elena', last_name: 'Rodríguez', email: 'elenar.ptest@test.com', phone: '633444555', gdpr_consent: false },
                { first_name: 'Sofía', last_name: 'López', email: 'sofial.ptest@test.com', phone: '644555666', gdpr_consent: true },
            ];
            console.log('Inserting new patients...');
            for (const p of patientsData) {
                // check if exists
                const { data: exists } = await supabase.from('patients').select('id').eq('email', p.email).maybeSingle();
                if (!exists) {
                    await supabase.from('patients').insert(p);
                }
            }
            const { data: freshPat } = await supabase.from('patients').select('*');
            currentPatients = freshPat;
        }

        // 4. APPOINTMENTS (Today)
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const baseDate = `${yyyy}-${mm}-${dd}`;

        const mkTime = (hour, min) => {
            const d = new Date(`${baseDate}T00:00:00`);
            d.setHours(hour, min, 0, 0);
            return d.toISOString();
        }

        // We assume we have the services and patients now. Let's make 4-5 appointments for today
        const appointmentsData = [
            {
                patient_id: currentPatients[0].id,
                patient_name: `${currentPatients[0].first_name} ${currentPatients[0].last_name}`,
                patient_email: currentPatients[0].email,
                patient_phone: currentPatients[0].phone,
                service_id: currentServices[0].id, // Fisioterapia General
                professional_id: currentProfessionals[0].id,
                start_time: mkTime(9, 0),
                end_time: mkTime(10, 0),
                status: 'completed',
                source: 'admin'
            },
            {
                patient_id: currentPatients[1].id,
                patient_name: `${currentPatients[1].first_name} ${currentPatients[1].last_name}`,
                patient_email: currentPatients[1].email,
                patient_phone: currentPatients[1].phone,
                service_id: currentServices[currentServices.length > 4 ? 4 : 0].id,
                professional_id: currentProfessionals[1] ? currentProfessionals[1].id : currentProfessionals[0].id,
                start_time: mkTime(10, 30),
                end_time: mkTime(11, 0),
                status: 'confirmed',
                source: 'admin'
            },
            {
                patient_id: currentPatients[2].id,
                patient_name: `${currentPatients[2].first_name} ${currentPatients[2].last_name}`,
                patient_email: currentPatients[2].email,
                patient_phone: currentPatients[2].phone,
                service_id: currentServices[1] ? currentServices[1].id : currentServices[0].id,
                professional_id: currentProfessionals[0].id,
                start_time: mkTime(12, 0),
                end_time: mkTime(12, 45),
                status: 'pending',
                source: 'admin'
            },
            {
                patient_id: currentPatients[3].id,
                patient_name: `${currentPatients[3].first_name} ${currentPatients[3].last_name}`,
                patient_email: currentPatients[3].email,
                patient_phone: currentPatients[3].phone,
                service_id: currentServices[3] ? currentServices[3].id : currentServices[0].id,
                professional_id: currentProfessionals[1] ? currentProfessionals[1].id : currentProfessionals[0].id,
                start_time: mkTime(16, 0),
                end_time: mkTime(17, 0),
                status: 'confirmed',
                source: 'admin'
            },
            {
                patient_id: currentPatients[4].id,
                patient_name: `${currentPatients[4].first_name} ${currentPatients[4].last_name}`,
                patient_email: currentPatients[4].email,
                patient_phone: currentPatients[4].phone,
                service_id: currentServices[2] ? currentServices[2].id : currentServices[0].id,
                professional_id: currentProfessionals[0].id,
                start_time: mkTime(17, 30),
                end_time: mkTime(18, 30),
                status: 'pending',
                source: 'web'
            },
        ];

        console.log('Inserting appointments for today...');
        // delete old mock appointments for today to avoid huge stacking on multiple script runs
        const startOfDay = mkTime(0, 0);
        const endOfDay = mkTime(23, 59);
        await supabase.from('appointments').delete().gte('start_time', startOfDay).lte('start_time', endOfDay);

        const { error: aptErr } = await supabase.from('appointments').insert(appointmentsData);
        if (aptErr) throw aptErr;

        console.log('✅ Seed complete! You can now check the dashboard.');

    } catch (e) {
        console.error('❌ Error seeding data:', e);
    }
}

seed();
