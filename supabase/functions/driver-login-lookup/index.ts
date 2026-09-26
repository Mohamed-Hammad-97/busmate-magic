import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Keep only digits and drop Egyptian country prefix / leading zero
function normalize(phone: unknown): string {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return digits.replace(/^20/, '').replace(/^0/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const body = await req.json().catch(() => ({}))
    const target = normalize(body?.phone)
    const password = typeof body?.password === 'string' ? body.password : ''

    if (target.length < 9 || target.length > 15 || !password || password.length > 200) {
      return json({ code: 'BAD_REQUEST', error: 'Invalid phone' }, 400)
    }

    const { data: accounts, error } = await supabase
      .from('driver_accounts')
      .select('id, phone, user_id, is_active, driver:drivers(phone), supervisor:supervisors(phone)')

    if (error) {
      console.error('lookup query failed:', error.message)
      return json({ code: 'UNEXPECTED', error: 'Lookup failed' }, 500)
    }

    const matches = (accounts || []).filter((a: any) => {
      const candidates = [a.phone, a.driver?.phone, a.supervisor?.phone]
      return candidates.some((c) => c && normalize(c) === target)
    })

    if (matches.length === 0) {
      return json({ code: 'NOT_FOUND', error: 'No account for this phone' }, 404)
    }

    // Prefer an active account when several records share the number
    const account = matches.find((a: any) => a.is_active) ?? matches[0]

    if (!account.is_active) {
      return json({ code: 'INACTIVE', error: 'Account disabled' }, 403)
    }

    const { data: userRes, error: userErr } = await supabase.auth.admin.getUserById(account.user_id)
    if (userErr || !userRes?.user?.email) {
      console.error('auth user missing for account:', account.id)
      return json({ code: 'NOT_FOUND', error: 'No login for this account' }, 404)
    }

    // Verify the password server-side; the login email is never returned.
    const anon = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
      email: userRes.user.email,
      password,
    })
    if (signInErr || !signIn?.session) {
      const status = (signInErr as any)?.status
      if (status === 429) return json({ code: 'RATE_LIMITED', error: 'Too many attempts' }, 429)
      return json({ code: 'WRONG_PASSWORD', error: 'Invalid credentials' }, 401)
    }

    return json({
      session: {
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      },
    })
  } catch (e) {
    console.error('driver-login-lookup error:', e instanceof Error ? e.message : e)
    return json({ code: 'UNEXPECTED', error: 'Unexpected error' }, 500)
  }
})
