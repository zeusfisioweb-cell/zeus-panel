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

async function createAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]
  const fullName = process.argv[4] ?? 'Admin'

  if (!email || !password) {
    console.error('Usage: tsx scripts/create-admin.ts <email> <password> [fullName]')
    process.exit(1)
  }

  console.log(`Creating admin: ${email}`)

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  let userId: string | undefined

  if (error) {
    if (error.code === 'email_exists' || error.message.includes('already registered')) {
      console.log('User exists — updating password and role')
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
      if (listError) {
        console.error('Error listing users:', listError)
        process.exit(1)
      }
      const user = listData.users.find((u) => u.email === email)
      if (!user) {
        console.error('User not found after exists error')
        process.exit(1)
      }
      userId = user.id
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      })
      if (updateError) {
        console.error('Error updating password:', updateError)
        process.exit(1)
      }
      console.log('Password updated')
    } else {
      console.error('Error creating user:', error)
      process.exit(1)
    }
  } else {
    userId = data.user.id
    console.log('User created:', userId)
  }

  if (!userId) {
    console.error('No user id')
    process.exit(1)
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, role: 'owner', full_name: fullName, email })

  if (profileError) {
    console.error('Error upserting profile:', profileError)
    process.exit(1)
  }

  console.log(`Admin ready: ${email} (role=owner)`)
}

createAdmin()
