
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

async function testSignIn() {
  const email = 'admin@zeus.com'
  const password = 'password123'

  console.log(`Testing sign in for: ${email}`)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Sign in failed:', error.message)
  } else {
    console.log('Sign in successful! User ID:', data.user.id)
  }
}

testSignIn()
