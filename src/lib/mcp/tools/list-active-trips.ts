import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_active_trips",
  title: "List active trips",
  description: "List bus trips currently in progress with their line and last known location.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    const { data, error } = await supabaseForUser(ctx)
      .from("live_trips")
      .select("id, route_id, started_at, current_latitude, current_longitude, last_location_update, routes(name, route_number)")
      .eq("status", "in_progress")
      .order("started_at", { ascending: false });
    if (error) throw new ToolError(error.message);
    const trips = (data ?? []).map((t: any) => ({
      id: String(t.id),
      route_id: String(t.route_id),
      line: t.routes ? `#${t.routes.route_number ?? ""} ${t.routes.name ?? ""}`.trim() : null,
      started_at: t.started_at ?? null,
      latitude: t.current_latitude ?? null,
      longitude: t.current_longitude ?? null,
      last_location_update: t.last_location_update ?? null,
    }));
    return { content: [{ type: "text", text: JSON.stringify(trips) }], structuredContent: { trips } };
  },
});
