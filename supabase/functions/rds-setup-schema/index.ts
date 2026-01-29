import { getRdsClient } from "../_shared/rds-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting RDS schema setup...");
    
    const sql = getRdsClient();

    // Test connection first
    console.log("Testing connection...");
    const testResult = await sql`SELECT 1 as test`;
    console.log("Connection successful:", testResult);

    // Create custom types (enums)
    console.log("Creating types...");
    await sql`
      DO $$ BEGIN
        CREATE TYPE app_role AS ENUM ('super_admin', 'employee');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        CREATE TYPE car_type AS ENUM ('ac', 'non_ac');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        CREATE TYPE department AS ENUM ('customer_support', 'operations', 'finance', 'reports');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        CREATE TYPE education_department AS ENUM ('national', 'ig', 'american');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'overdue');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        CREATE TYPE registration_status AS ENUM ('pending_fees', 'complete', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        CREATE TYPE subscription_type AS ENUM ('monthly', 'yearly');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        CREATE TYPE trip_notification_type AS ENUM ('trip_started', 'arriving_soon', 'arrived_at_pickup', 'picked_up', 'arrived_at_school', 'trip_completed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    await sql`
      DO $$ BEGIN
        CREATE TYPE trip_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log("Types created successfully");

    // Create auth_users table
    console.log("Creating auth_users table...");
    await sql`
      CREATE TABLE IF NOT EXISTS auth_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        phone TEXT,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        phone_verified BOOLEAN DEFAULT FALSE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_auth_users_phone ON auth_users(phone)`;

    // Create user_roles table
    console.log("Creating user_roles table...");
    await sql`
      CREATE TABLE IF NOT EXISTS user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        role app_role NOT NULL DEFAULT 'employee',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, role)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id)`;

    // Create cities table
    console.log("Creating cities table...");
    await sql`
      CREATE TABLE IF NOT EXISTS cities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Create schools table
    console.log("Creating schools table...");
    await sql`
      CREATE TABLE IF NOT EXISTS schools (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        city TEXT,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_schools_city ON schools(city)`;

    // Create employees table
    console.log("Creating employees table...");
    await sql`
      CREATE TABLE IF NOT EXISTS employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        departments department[] NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id)`;

    // Create drivers table
    console.log("Creating drivers table...");
    await sql`
      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        license_number TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT 'Cairo',
        documents_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_drivers_city ON drivers(city)`;

    // Create supervisors table
    console.log("Creating supervisors table...");
    await sql`
      CREATE TABLE IF NOT EXISTS supervisors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT 'Cairo',
        documents_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_supervisors_city ON supervisors(city)`;

    // Create driver_accounts table
    console.log("Creating driver_accounts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS driver_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
        driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
        supervisor_id UUID REFERENCES supervisors(id) ON DELETE CASCADE,
        phone TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_driver_accounts_user_id ON driver_accounts(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_driver_accounts_driver_id ON driver_accounts(driver_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_driver_accounts_supervisor_id ON driver_accounts(supervisor_id)`;

    // Create parent_accounts table
    console.log("Creating parent_accounts table...");
    await sql`
      CREATE TABLE IF NOT EXISTS parent_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
        parent_name TEXT NOT NULL,
        national_id TEXT NOT NULL,
        job TEXT,
        father_phone TEXT NOT NULL,
        mother_phone TEXT,
        emergency_phone TEXT NOT NULL,
        city TEXT NOT NULL,
        pickup_latitude DOUBLE PRECISION NOT NULL,
        pickup_longitude DOUBLE PRECISION NOT NULL,
        has_password BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_parent_accounts_user_id ON parent_accounts(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_parent_accounts_city ON parent_accounts(city)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_parent_accounts_father_phone ON parent_accounts(father_phone)`;

    // Create registrations table
    console.log("Creating registrations table...");
    await sql`
      CREATE TABLE IF NOT EXISTS registrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_id UUID NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
        student_name TEXT NOT NULL DEFAULT '',
        grade TEXT NOT NULL,
        education_department education_department NOT NULL,
        car_type car_type NOT NULL,
        status registration_status NOT NULL DEFAULT 'pending_fees',
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_registrations_parent_id ON registrations(parent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_registrations_school_id ON registrations(school_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status)`;

    // Create routes table
    console.log("Creating routes table...");
    await sql`
      CREATE TABLE IF NOT EXISTS routes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        school_id UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
        driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
        supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
        car_type car_type NOT NULL,
        max_seats INTEGER NOT NULL,
        route_duration_minutes INTEGER,
        route_data JSONB,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_routes_school_id ON routes(school_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_routes_supervisor_id ON routes(supervisor_id)`;

    // Create route_assignments table
    console.log("Creating route_assignments table...");
    await sql`
      CREATE TABLE IF NOT EXISTS route_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
        registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
        pickup_order INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(route_id, registration_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_route_assignments_route_id ON route_assignments(route_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_route_assignments_registration_id ON route_assignments(registration_id)`;

    // Create subscriptions table
    console.log("Creating subscriptions table...");
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        registration_id UUID NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE,
        subscription_type subscription_type NOT NULL,
        value NUMERIC NOT NULL,
        number_of_installments INTEGER NOT NULL DEFAULT 1,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_registration_id ON subscriptions(registration_id)`;

    // Create payments table
    console.log("Creating payments table...");
    await sql`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL,
        installment_number INTEGER NOT NULL,
        due_date DATE NOT NULL,
        paid_date DATE,
        status payment_status NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date)`;

    // Create live_trips table
    console.log("Creating live_trips table...");
    await sql`
      CREATE TABLE IF NOT EXISTS live_trips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        route_id UUID NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
        driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
        supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
        started_by UUID,
        status trip_status NOT NULL DEFAULT 'pending',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        current_latitude DOUBLE PRECISION,
        current_longitude DOUBLE PRECISION,
        last_location_update TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_live_trips_route_id ON live_trips(route_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_live_trips_status ON live_trips(status)`;

    // Create trip_student_status table
    console.log("Creating trip_student_status table...");
    await sql`
      CREATE TABLE IF NOT EXISTS trip_student_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        live_trip_id UUID NOT NULL REFERENCES live_trips(id) ON DELETE CASCADE,
        registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        pickup_order INTEGER,
        arrived_at TIMESTAMPTZ,
        picked_up_at TIMESTAMPTZ,
        dropped_off_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_trip_student_status_live_trip_id ON trip_student_status(live_trip_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_trip_student_status_registration_id ON trip_student_status(registration_id)`;

    // Create trip_notifications table
    console.log("Creating trip_notifications table...");
    await sql`
      CREATE TABLE IF NOT EXISTS trip_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        live_trip_id UUID NOT NULL REFERENCES live_trips(id) ON DELETE CASCADE,
        registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE,
        notification_type trip_notification_type NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_trip_notifications_live_trip_id ON trip_notifications(live_trip_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_trip_notifications_registration_id ON trip_notifications(registration_id)`;

    // Create trip_logs table
    console.log("Creating trip_logs table...");
    await sql`
      CREATE TABLE IF NOT EXISTS trip_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        route_id UUID NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
        trip_date DATE NOT NULL,
        departure_time TIME,
        arrival_time TIME,
        notes TEXT,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_trip_logs_route_id ON trip_logs(route_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_trip_logs_trip_date ON trip_logs(trip_date)`;

    // Create attendance table
    console.log("Creating attendance table...");
    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_log_id UUID NOT NULL REFERENCES trip_logs(id) ON DELETE CASCADE,
        registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
        present BOOLEAN NOT NULL DEFAULT FALSE,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_attendance_trip_log_id ON attendance(trip_log_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_attendance_registration_id ON attendance(registration_id)`;

    // Create incident_reports table
    console.log("Creating incident_reports table...");
    await sql`
      CREATE TABLE IF NOT EXISTS incident_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trip_log_id UUID REFERENCES trip_logs(id) ON DELETE SET NULL,
        route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
        reported_by UUID,
        description TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'low',
        resolved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_incident_reports_route_id ON incident_reports(route_id)`;

    // Create customer_feedback table
    console.log("Creating customer_feedback table...");
    await sql`
      CREATE TABLE IF NOT EXISTS customer_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
        employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
        message TEXT NOT NULL,
        is_from_parent BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_customer_feedback_registration_id ON customer_feedback(registration_id)`;

    // Create chat_conversations table
    console.log("Creating chat_conversations table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_id UUID NOT NULL REFERENCES parent_accounts(id) ON DELETE CASCADE,
        assigned_to UUID REFERENCES employees(id) ON DELETE SET NULL,
        subject TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_conversations_parent_id ON chat_conversations(parent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_conversations_status ON chat_conversations(status)`;

    // Create chat_messages table
    console.log("Creating chat_messages table...");
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL,
        sender_type TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id)`;

    // Create otp_codes table
    console.log("Creating otp_codes table...");
    await sql`
      CREATE TABLE IF NOT EXISTS otp_codes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR NOT NULL,
        code VARCHAR NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at)`;

    // Create push_subscriptions table
    console.log("Creating push_subscriptions table...");
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)`;

    // Create sensitive_data_access_log table
    console.log("Creating sensitive_data_access_log table...");
    await sql`
      CREATE TABLE IF NOT EXISTS sensitive_data_access_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        table_name TEXT NOT NULL,
        record_id UUID NOT NULL,
        action TEXT NOT NULL DEFAULT 'view',
        ip_address TEXT,
        user_agent TEXT,
        accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_sensitive_data_access_log_user_id ON sensitive_data_access_log(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sensitive_data_access_log_accessed_at ON sensitive_data_access_log(accessed_at)`;

    // Create updated_at trigger function
    console.log("Creating trigger function...");
    await sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    // Apply triggers
    console.log("Creating triggers...");
    const triggers = [
      { table: 'auth_users', name: 'update_auth_users_updated_at' },
      { table: 'cities', name: 'update_cities_updated_at' },
      { table: 'schools', name: 'update_schools_updated_at' },
      { table: 'employees', name: 'update_employees_updated_at' },
      { table: 'drivers', name: 'update_drivers_updated_at' },
      { table: 'supervisors', name: 'update_supervisors_updated_at' },
      { table: 'driver_accounts', name: 'update_driver_accounts_updated_at' },
      { table: 'parent_accounts', name: 'update_parent_accounts_updated_at' },
      { table: 'registrations', name: 'update_registrations_updated_at' },
      { table: 'routes', name: 'update_routes_updated_at' },
      { table: 'subscriptions', name: 'update_subscriptions_updated_at' },
      { table: 'payments', name: 'update_payments_updated_at' },
      { table: 'live_trips', name: 'update_live_trips_updated_at' },
      { table: 'trip_student_status', name: 'update_trip_student_status_updated_at' },
      { table: 'incident_reports', name: 'update_incident_reports_updated_at' },
      { table: 'chat_conversations', name: 'update_chat_conversations_updated_at' },
      { table: 'push_subscriptions', name: 'update_push_subscriptions_updated_at' },
    ];

    for (const { table, name } of triggers) {
      await sql.unsafe(`
        DROP TRIGGER IF EXISTS ${name} ON ${table};
        CREATE TRIGGER ${name} BEFORE UPDATE ON ${table} 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    console.log("Schema setup complete!");

    await sql.end();

    return new Response(
      JSON.stringify({
        success: true,
        message: "RDS schema created successfully!",
        tables: [
          'auth_users', 'user_roles', 'cities', 'schools', 'employees',
          'drivers', 'supervisors', 'driver_accounts', 'parent_accounts',
          'registrations', 'routes', 'route_assignments', 'subscriptions',
          'payments', 'live_trips', 'trip_student_status', 'trip_notifications',
          'trip_logs', 'attendance', 'incident_reports', 'customer_feedback',
          'chat_conversations', 'chat_messages', 'otp_codes', 'push_subscriptions',
          'sensitive_data_access_log'
        ]
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in rds-setup-schema:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
