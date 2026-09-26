import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRoutesTool from "./tools/list-routes";
import listActiveTripsTool from "./tools/list-active-trips";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "seater-dashboard",
  title: "Seater Dashboard",
  version: "0.1.0",
  instructions:
    "Read-only tools for Seater school bus operations. Use `list_routes` to find bus lines and `list_active_trips` to see buses currently on the road. Results respect the signed-in user's permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRoutesTool, listActiveTripsTool],
});
