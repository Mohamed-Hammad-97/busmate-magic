import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Validation helpers
function validatePhone(phone: string): boolean {
  return /^01[0125]\d{8}$/.test(phone);
}

function validatePassword(password: string): boolean {
  return password.length >= 6;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get the authorization header to verify the caller
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the caller is an authenticated user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token)
    
    if (callerError || !caller) {
      console.error('Auth error:', callerError?.message)
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if caller has operations department access or is super_admin
    const { data: callerEmployee } = await supabaseAdmin
      .from('employees')
      .select('departments')
      .eq('user_id', caller.id)
      .single()

    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single()

    const hasOperationsAccess = callerEmployee?.departments?.includes('operations') || 
                                 callerRole?.role === 'super_admin'

    if (!hasOperationsAccess) {
      console.log('Unauthorized access attempt by user:', caller.id)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Only operations staff can create driver accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { phone, password, accountType, personId } = await req.json()

    // Server-side validation
    if (!phone || !validatePhone(phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!password || !validatePassword(password)) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!accountType || !['driver', 'supervisor'].includes(accountType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid account type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!personId) {
      return new Response(
        JSON.stringify({ error: 'Person ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the driver/supervisor exists and is active
    const tableName = accountType === 'driver' ? 'drivers' : 'supervisors'
    const { data: person, error: personError } = await supabaseAdmin
      .from(tableName)
      .select('id, is_active')
      .eq('id', personId)
      .single()

    if (personError || !person) {
      console.error('Person not found:', personError)
      return new Response(
        JSON.stringify({ error: `${accountType === 'driver' ? 'Driver' : 'Supervisor'} not found` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!person.is_active) {
      return new Response(
        JSON.stringify({ error: `${accountType === 'driver' ? 'Driver' : 'Supervisor'} is not active` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if account already exists for this person
    const columnName = accountType === 'driver' ? 'driver_id' : 'supervisor_id'
    const { data: existingAccount } = await supabaseAdmin
      .from('driver_accounts')
      .select('id')
      .eq(columnName, personId)
      .single()

    if (existingAccount) {
      return new Response(
        JSON.stringify({ error: 'An account already exists for this person' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create the auth user using admin API
    const formattedPhone = phone.replace(/\D/g, '')
    const email = `driver_${formattedPhone}@seater.app`

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        phone,
        account_type: accountType,
      }
    })

    if (authError) {
      console.error('Auth user creation error:', authError.message)
      return new Response(
        JSON.stringify({ error: 'Failed to create user account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = authData.user.id

    // Create driver account record
    const accountData: any = {
      user_id: userId,
      phone,
      is_active: true,
    }

    if (accountType === 'driver') {
      accountData.driver_id = personId
    } else {
      accountData.supervisor_id = personId
    }

    const { error: insertError } = await supabaseAdmin
      .from('driver_accounts')
      .insert(accountData)

    if (insertError) {
      console.error('Driver account creation error:', insertError)
      // Rollback: delete the auth user if driver account creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(
        JSON.stringify({ error: 'Failed to create driver account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Driver account created successfully:', userId, 'by:', caller.id)

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error')
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
