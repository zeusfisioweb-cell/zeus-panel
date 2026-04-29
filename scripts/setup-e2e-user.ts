
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupUser() {
  const email = 'admin@zeus.com'
  const password = 'password123'

  console.log(`Setting up user: ${email}`)

  // Try to create user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Admin Zeus' }
  })

  if (error) {
    if (error.code === 'email_exists' || error.message.includes('already registered')) {
      console.log('User already exists, updating password...')
      // Update password
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
      if (listError) {
        console.error('Error listing users:', listError)
        return
      }
      const user = listData.users.find(u => u.email === email)
      if (user) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password })
        if (updateError) console.error('Error updating password:', updateError)
        else console.log('Password updated successfully')

        // Ensure profile exists
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ id: user.id, role: 'owner', full_name: 'Admin Zeus', email: email })
        
        if (profileError) console.error('Error upserting profile:', profileError)
        else console.log('Profile ensured')
      }
    } else {
      console.error('Error creating user:', error)
    }
  } else {
    console.log('User created successfully:', data.user.id)
    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: data.user.id, role: 'owner', full_name: 'Admin Zeus', email: email })
    
    if (profileError) console.error('Error creating profile:', profileError)
    else console.log('Profile created')
  }
}

setupUser()
