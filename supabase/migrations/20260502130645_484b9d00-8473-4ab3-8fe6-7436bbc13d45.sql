
-- Enums
DO $$ BEGIN
  CREATE TYPE public.daily_line_payment_method AS ENUM ('cash', 'instapay');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.daily_line_payment_status AS ENUM ('pending', 'paid', 'cancelled', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.daily_line_trip_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.daily_line_promo_type AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS public.daily_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_lines_city ON public.daily_lines(city);

CREATE TABLE IF NOT EXISTS public.daily_line_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES public.daily_lines(id) ON DELETE CASCADE,
  name text NOT NULL,
  station_type text NOT NULL DEFAULT 'both',
  station_order int NOT NULL DEFAULT 0,
  latitude double precision,
  longitude double precision,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_line_stations_line ON public.daily_line_stations(line_id);

CREATE TABLE IF NOT EXISTS public.daily_line_trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES public.daily_lines(id) ON DELETE RESTRICT,
  trip_date date NOT NULL,
  departure_time time NOT NULL,
  total_seats int NOT NULL DEFAULT 0,
  available_seats int NOT NULL DEFAULT 0,
  cash_price numeric NOT NULL DEFAULT 0,
  instapay_price numeric NOT NULL DEFAULT 0,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  status public.daily_line_trip_status NOT NULL DEFAULT 'scheduled',
  started_at timestamptz,
  completed_at timestamptz,
  current_latitude double precision,
  current_longitude double precision,
  last_location_update timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_line_trips_line ON public.daily_line_trips(line_id);
CREATE INDEX IF NOT EXISTS idx_daily_line_trips_date ON public.daily_line_trips(trip_date);
CREATE INDEX IF NOT EXISTS idx_daily_line_trips_driver ON public.daily_line_trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_daily_line_trips_status ON public.daily_line_trips(status);

CREATE TABLE IF NOT EXISTS public.daily_line_promocodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  promo_type public.daily_line_promo_type NOT NULL DEFAULT 'percentage',
  value numeric NOT NULL DEFAULT 0,
  max_uses int,
  used_count int NOT NULL DEFAULT 0,
  expires_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_line_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.daily_line_trips(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.parent_accounts(id) ON DELETE SET NULL,
  passenger_name text NOT NULL,
  passenger_phone text NOT NULL,
  pickup_station_id uuid REFERENCES public.daily_line_stations(id) ON DELETE SET NULL,
  dropoff_station_id uuid REFERENCES public.daily_line_stations(id) ON DELETE SET NULL,
  payment_method public.daily_line_payment_method NOT NULL,
  promocode_id uuid REFERENCES public.daily_line_promocodes(id) ON DELETE SET NULL,
  original_price numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  final_price numeric NOT NULL DEFAULT 0,
  payment_status public.daily_line_payment_status NOT NULL DEFAULT 'pending',
  payment_proof_url text,
  boarding_code text NOT NULL,
  boarded_at timestamptz,
  dropped_at timestamptz,
  marked_paid_by uuid,
  marked_paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, boarding_code)
);
CREATE INDEX IF NOT EXISTS idx_daily_line_bookings_trip ON public.daily_line_bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_daily_line_bookings_parent ON public.daily_line_bookings(parent_id);
CREATE INDEX IF NOT EXISTS idx_daily_line_bookings_phone ON public.daily_line_bookings(passenger_phone);

CREATE TABLE IF NOT EXISTS public.daily_line_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.daily_line_settings (key, value) VALUES
  ('instapay_account_name', ''),
  ('instapay_ipa', ''),
  ('instapay_bank_name', ''),
  ('instapay_instructions', ''),
  ('whatsapp_number', '')
ON CONFLICT (key) DO NOTHING;

-- updated_at triggers
CREATE TRIGGER trg_daily_lines_updated BEFORE UPDATE ON public.daily_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_daily_line_stations_updated BEFORE UPDATE ON public.daily_line_stations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_daily_line_trips_updated BEFORE UPDATE ON public.daily_line_trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_daily_line_promocodes_updated BEFORE UPDATE ON public.daily_line_promocodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_daily_line_bookings_updated BEFORE UPDATE ON public.daily_line_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_daily_line_settings_updated BEFORE UPDATE ON public.daily_line_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seat counter trigger
CREATE OR REPLACE FUNCTION public.daily_line_update_seats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.daily_line_trips
      SET available_seats = GREATEST(available_seats - 1, 0)
      WHERE id = NEW.trip_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status <> 'cancelled' AND NEW.payment_status = 'cancelled' THEN
      UPDATE public.daily_line_trips SET available_seats = available_seats + 1 WHERE id = NEW.trip_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.payment_status <> 'cancelled' THEN
      UPDATE public.daily_line_trips SET available_seats = available_seats + 1 WHERE id = OLD.trip_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_daily_line_bookings_seats
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_line_bookings
  FOR EACH ROW EXECUTE FUNCTION public.daily_line_update_seats();

-- RLS
ALTER TABLE public.daily_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_line_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_line_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_line_promocodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_line_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_line_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active daily lines" ON public.daily_lines
  FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage daily lines" ON public.daily_lines
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department)
  ) WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department)
  );

CREATE POLICY "Public can view active stations" ON public.daily_line_stations
  FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage stations" ON public.daily_line_stations
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department)
  ) WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department)
  );

CREATE POLICY "Public can view bookable trips" ON public.daily_line_trips
  FOR SELECT USING (status IN ('scheduled', 'in_progress'));
CREATE POLICY "Staff manage trips" ON public.daily_line_trips
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department)
  ) WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department)
  );
CREATE POLICY "Drivers view assigned daily trips" ON public.daily_line_trips
  FOR SELECT USING (driver_id = get_user_driver_id(auth.uid()));
CREATE POLICY "Drivers update assigned daily trips" ON public.daily_line_trips
  FOR UPDATE USING (driver_id = get_user_driver_id(auth.uid()));

CREATE POLICY "Public can view active promocodes" ON public.daily_line_promocodes
  FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage promocodes" ON public.daily_line_promocodes
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department) OR
    has_department(auth.uid(), 'finance'::department)
  ) WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department) OR
    has_department(auth.uid(), 'finance'::department)
  );

CREATE POLICY "Anyone can create bookings" ON public.daily_line_bookings
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Parents view own bookings" ON public.daily_line_bookings
  FOR SELECT USING (parent_id IN (SELECT get_user_parent_ids(auth.uid())));
CREATE POLICY "Parents update own bookings" ON public.daily_line_bookings
  FOR UPDATE USING (parent_id IN (SELECT get_user_parent_ids(auth.uid())));
CREATE POLICY "Staff manage bookings" ON public.daily_line_bookings
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department) OR
    has_department(auth.uid(), 'finance'::department)
  ) WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department) OR
    has_department(auth.uid(), 'customer_support'::department) OR
    has_department(auth.uid(), 'finance'::department)
  );
CREATE POLICY "Drivers view bookings on assigned trips" ON public.daily_line_bookings
  FOR SELECT USING (
    trip_id IN (SELECT id FROM public.daily_line_trips WHERE driver_id = get_user_driver_id(auth.uid()))
  );
CREATE POLICY "Drivers update bookings on assigned trips" ON public.daily_line_bookings
  FOR UPDATE USING (
    trip_id IN (SELECT id FROM public.daily_line_trips WHERE driver_id = get_user_driver_id(auth.uid()))
  );

CREATE POLICY "Public can view daily line settings" ON public.daily_line_settings
  FOR SELECT USING (true);
CREATE POLICY "Staff manage daily line settings" ON public.daily_line_settings
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department)
  ) WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR
    has_department(auth.uid(), 'operation_daily_lines'::department)
  );
