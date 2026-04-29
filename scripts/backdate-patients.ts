import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const { data: patients, error: getErr } = await supabase
    .from('patients')
    .select('id');

  if (getErr || !patients) {
    console.error('Error fetching', getErr);
    return;
  }

  console.log(`Found ${patients.length} patients, spreading dates...`);

  const now = new Date();
  
  for (let i = 0; i < patients.length; i++) {
    // Spread them over the last 2 years randomly
    const daysAgo = Math.floor(Math.random() * 365 * 2);
    const d = new Date(now);
    d.setDate(now.getDate() - daysAgo);

    const { error: updErr } = await supabase
      .from('patients')
      .update({ created_at: d.toISOString() })
      .eq('id', patients[i].id);

    if (updErr) {
        console.error('Error updating', updErr);
    }
  }

  console.log('Done!');
}

run();
