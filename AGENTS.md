# Architecture rules

- MCP server lives in `src/lib/mcp/` (tools + `defineMcp` entry), secured by Lovable Cloud OAuth with consent at `/.lovable/oauth/consent` — AI clients act as the signed-in user so RLS applies.
