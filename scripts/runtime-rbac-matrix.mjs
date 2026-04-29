import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const ownerEmail = process.env.PANEL_E2E_EMAIL || process.env.PANEL_ADMIN_EMAIL || 'admin@zeus.com';
const ownerPassword = process.env.PANEL_E2E_PASSWORD || process.env.PANEL_ADMIN_PASSWORD || 'password123';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function newAnonClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(email, password) {
  const client = newAnonClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(`signIn failed for ${email}: ${error?.message ?? 'unknown error'}`);
  }
  return { client, userId: data.user.id };
}

function nowTag() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

async function main() {
  const tag = nowTag();
  const tempPassword = `Zeus-${tag}-A!`;

  const proAEmail = `rbac-pro-a-${tag}@example.invalid`;
  const proBEmail = `rbac-pro-b-${tag}@example.invalid`;

  let ownerClient = null;
  let ownerUserId = null;
  let proAUserId = null;
  let proBUserId = null;
  let proAClient = null;
  let proBClient = null;
  let patientId = null;

  const result = {
    executed_at: new Date().toISOString(),
    setup: {},
    checks: {},
    cleanup: {},
  };

  try {
    const ownerSession = await signIn(ownerEmail, ownerPassword);
    ownerClient = ownerSession.client;
    ownerUserId = ownerSession.userId;

    const { data: ownerProfile, error: ownerProfileError } = await ownerClient
      .from('profiles')
      .select('role')
      .eq('id', ownerUserId)
      .maybeSingle();

    if (ownerProfileError) {
      throw new Error(`owner profile lookup failed: ${ownerProfileError.message}`);
    }
    result.checks.owner_profile_role = ownerProfile?.role ?? null;

    const proAUserRes = await admin.auth.admin.createUser({
      email: proAEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: `RBAC Pro A ${tag}` },
    });
    if (proAUserRes.error || !proAUserRes.data.user) {
      throw new Error(`create proA user failed: ${proAUserRes.error?.message ?? 'unknown'}`);
    }
    proAUserId = proAUserRes.data.user.id;

    const proBUserRes = await admin.auth.admin.createUser({
      email: proBEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: `RBAC Pro B ${tag}` },
    });
    if (proBUserRes.error || !proBUserRes.data.user) {
      throw new Error(`create proB user failed: ${proBUserRes.error?.message ?? 'unknown'}`);
    }
    proBUserId = proBUserRes.data.user.id;

    const { error: upsertProfilesError } = await admin
      .from('profiles')
      .upsert([
        { id: proAUserId, email: proAEmail, role: 'professional', full_name: `RBAC Pro A ${tag}` },
        { id: proBUserId, email: proBEmail, role: 'professional', full_name: `RBAC Pro B ${tag}` },
      ]);
    if (upsertProfilesError) {
      throw new Error(`upsert profiles failed: ${upsertProfilesError.message}`);
    }

    const { error: insertProfessionalsError } = await admin
      .from('professionals')
      .upsert([
        {
          id: proAUserId,
          user_id: proAUserId,
          specialty: 'runtime-matrix',
          bio: null,
          color_code: '#AD7332',
          is_active: true,
        },
        {
          id: proBUserId,
          user_id: proBUserId,
          specialty: 'runtime-matrix',
          bio: null,
          color_code: '#4F46E5',
          is_active: true,
        },
      ]);
    if (insertProfessionalsError) {
      throw new Error(`insert professionals failed: ${insertProfessionalsError.message}`);
    }

    const patientInsertRes = await admin
      .from('patients')
      .insert({
        first_name: `RBAC${tag}`,
        last_name: 'Matrix',
        phone: `600${tag.slice(-6)}`,
        email: null,
        gdpr_consent: true,
        marketing_consent: false,
        created_by: ownerUserId,
      })
      .select('id')
      .single();
    if (patientInsertRes.error || !patientInsertRes.data) {
      throw new Error(`insert patient failed: ${patientInsertRes.error?.message ?? 'unknown'}`);
    }
    patientId = patientInsertRes.data.id;

    const { error: assignError } = await admin
      .from('patient_professionals')
      .insert({
        patient_id: patientId,
        professional_id: proAUserId,
        assigned_by: ownerUserId,
        source: 'manual',
      });
    if (assignError) {
      throw new Error(`assign patient->proA failed: ${assignError.message}`);
    }

    result.setup = {
      owner_user_id: ownerUserId,
      pro_a_user_id: proAUserId,
      pro_b_user_id: proBUserId,
      patient_id: patientId,
    };

    proAClient = (await signIn(proAEmail, tempPassword)).client;
    proBClient = (await signIn(proBEmail, tempPassword)).client;

    const anonClient = newAnonClient();

    const anonAssignments = await anonClient
      .from('patient_professionals')
      .select('patient_id')
      .limit(1);
    result.checks.anon_patient_professionals_select = {
      allowed: !anonAssignments.error,
      error: anonAssignments.error?.message ?? null,
    };

    const ownerPatientsCount = await ownerClient
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null);
    result.checks.owner_active_patients_count = ownerPatientsCount.count ?? 0;

    const proAVisiblePatient = await proAClient
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .maybeSingle();
    result.checks.pro_a_can_view_assigned_patient = {
      allowed: Boolean(proAVisiblePatient.data),
      error: proAVisiblePatient.error?.message ?? null,
    };

    const proBVisiblePatient = await proBClient
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .maybeSingle();
    result.checks.pro_b_can_view_pro_a_patient = {
      allowed: Boolean(proBVisiblePatient.data),
      error: proBVisiblePatient.error?.message ?? null,
    };

    const proAAssignments = await proAClient
      .from('patient_professionals')
      .select('patient_id, professional_id')
      .eq('professional_id', proAUserId)
      .eq('patient_id', patientId);
    result.checks.pro_a_assignment_row_visible = {
      count: proAAssignments.data?.length ?? 0,
      error: proAAssignments.error?.message ?? null,
    };

    const proBInsertAssignment = await proBClient
      .from('patient_professionals')
      .insert({
        patient_id: patientId,
        professional_id: proBUserId,
        assigned_by: proBUserId,
        source: 'manual',
      });
    result.checks.pro_b_can_self_assign = {
      allowed: !proBInsertAssignment.error,
      error: proBInsertAssignment.error?.message ?? null,
    };

  } finally {
    // Cleanup best-effort; do not throw.
    try {
      if (patientId) {
        await admin.from('patient_professionals').delete().eq('patient_id', patientId);
        await admin.from('patients').delete().eq('id', patientId);
      }
      if (proAUserId) {
        await admin.from('professionals').delete().eq('id', proAUserId);
        await admin.from('profiles').delete().eq('id', proAUserId);
        await admin.auth.admin.deleteUser(proAUserId);
      }
      if (proBUserId) {
        await admin.from('professionals').delete().eq('id', proBUserId);
        await admin.from('profiles').delete().eq('id', proBUserId);
        await admin.auth.admin.deleteUser(proBUserId);
      }
      result.cleanup.ok = true;
    } catch (cleanupError) {
      result.cleanup.ok = false;
      result.cleanup.error = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
