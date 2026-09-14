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

const digits = (phone: unknown) => String(phone ?? '').replace(/\D/g, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: callerError } = await admin.auth.getUser(token)
    if (callerError || !caller) return json({ error: 'Invalid token' }, 401)

    const { data: employee } = await admin
      .from('employees')
      .select('departments')
      .eq('user_id', caller.id)
      .maybeSingle()

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle()

    const departments: string[] = employee?.departments || []
    const authorized =
      roleRow?.role === 'super_admin' ||
      departments.some((d) =>
        ['operations', 'operation_companies', 'operation_daily_lines'].includes(d),
      )

    if (!authorized) return json({ error: 'Unauthorized' }, 403)

    const { action, accountId, password, phone } = await req.json()

    if (!accountId) return json({ error: 'accountId is required' }, 400)

    const { data: account, error: accountErr } = await admin
      .from('driver_accounts')
      .select('id, user_id, phone')
      .eq('id', accountId)
      .maybeSingle()

    if (accountErr || !account) return json({ error: 'Account not found' }, 404)

    if (action === 'reset_password') {
      if (!password || String(password).length < 6) {
        return json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, 400)
      }
      const { error } = await admin.auth.admin.updateUserById(account.user_id, {
        password: String(password),
      })
      if (error) {
        console.error('password reset failed:', error.message)
        return json({ error: 'تعذر تغيير كلمة المرور' }, 400)
      }
      console.log('password reset for account', accountId, 'by', caller.id)
      return json({ success: true })
    }

    if (action === 'update_phone') {
      const clean = digits(phone)
      if (!/^01[0125]\d{8}$/.test(clean)) {
        return json({ error: 'رقم الهاتف غير صالح' }, 400)
      }

      const { data: clash } = await admin
        .from('driver_accounts')
        .select('id')
        .eq('phone', clean)
        .neq('id', accountId)
        .maybeSingle()

      if (clash) return json({ error: 'هذا الرقم مستخدم بالفعل في حساب آخر' }, 400)

      const email = `driver_${clean}@seater.app`
      const { error: authErr } = await admin.auth.admin.updateUserById(account.user_id, {
        email,
        email_confirm: true,
      })
      if (authErr) {
        console.error('email update failed:', authErr.message)
        return json({ error: 'تعذر تحديث رقم الدخول' }, 400)
      }

      const { error: updateErr } = await admin
        .from('driver_accounts')
        .update({ phone: clean })
        .eq('id', accountId)

      if (updateErr) {
        // Roll the login address back so both stay in sync
        await admin.auth.admin.updateUserById(account.user_id, {
          email: `driver_${digits(account.phone)}@seater.app`,
          email_confirm: true,
        })
        console.error('account phone update failed:', updateErr.message)
        return json({ error: 'تعذر تحديث رقم الدخول' }, 400)
      }

      console.log('phone updated for account', accountId, 'by', caller.id)
      return json({ success: true })
    }

    return json({ error: 'Invalid action' }, 400)
  } catch (e) {
    console.error('manage-driver-account error:', e instanceof Error ? e.message : e)
    return json({ error: 'An unexpected error occurred' }, 500)
  }
})
