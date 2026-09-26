import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_routes",
  title: "List bus lines",
  description: "List school bus lines (number, name, school, status) visible to the signed-in user.",
  inputSchema: {
    search: z.string().trim().optional().describe("Optional text to match in the line name."),
    limit: z.number().int().min(1).max(200).default(50).describe("Maximum lines to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Not authenticated");
    let q = supabaseForUser(ctx)
      .from("routes")
      .select("id, name, route_number, is_active, schools(name)")
      .order("route_number", { ascending: true })
      .limit(limit);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const routes = (data ?? []).map((r: any) => ({
      id: String(r.id),
      route_number: r.route_number ?? null,
      name: String(r.name ?? ""),
      is_active: Boolean(r.is_active),
      school: r.schools?.name ?? null,
    }));
    return { content: [{ type: "text", text: JSON.stringify(routes) }], structuredContent: { routes } };
  },
});
