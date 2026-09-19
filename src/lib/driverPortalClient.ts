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
    // Keep the driver portal isolated from the general site client. Both
    // clients are loaded by the app bundle; sharing one key lets competing
    // startup/refresh cycles replace a newly accepted mobile session.
    storageKey: "seater-driver-portal-auth",
    storage: brokeredPreviewStorage(),
    persistSession: true,
    // Refresh is scheduled from the returned expires_in duration by the
    // driver auth provider. The SDK's immediate clock-based refresh can
    // invalidate fresh sessions on phones with inaccurate system clocks.
    autoRefreshToken: false,
    detectSessionInUrl: false,
    lock: phoneSafeLock,
  },
});