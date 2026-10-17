# Architecture rules

- MCP server lives in `src/lib/mcp/` (tools + `defineMcp` entry), secured by Lovable Cloud OAuth with consent at `/.lovable/oauth/consent` — AI clients act as the signed-in user so RLS applies.
- Daily-line station ETAs are stored as `daily_line_stations.minutes_from_start` (computed from Google driving times when a line is saved) and added to each trip's departure time client-side — avoids a Google call per booking.
