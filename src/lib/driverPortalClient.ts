import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { brokeredPreviewStorage } from "@/integrations/supabase/previewAuthStorage";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ColorOS and MIUI browsers can expose navigator.locks while occasionally
// failing to release an auth lock. A per-tab promise queue keeps auth calls
// ordered without relying on that browser API.
let authQueue: Promise<unknown> = Promise.resolve();

const phoneSafeLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  operation: () => Promise<R>,
): Promise<R> => {
  const result = authQueue.then(operation, operation);
  authQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
};

export const driverPortalClient = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    lock: phoneSafeLock,
  },
});