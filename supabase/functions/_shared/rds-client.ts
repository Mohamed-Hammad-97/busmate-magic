// Shared RDS PostgreSQL client for Edge Functions
import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

export function getRdsClient() {
  if (!sql) {
    const host = Deno.env.get("RDS_HOST");
    const user = Deno.env.get("RDS_USER");
    const password = Deno.env.get("RDS_PASSWORD");
    const database = Deno.env.get("RDS_DATABASE");

    if (!host || !user || !password || !database) {
      throw new Error("RDS connection environment variables not configured");
    }

    sql = postgres({
      host,
      port: 5432,
      database,
      username: user,
      password,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idle_timeout: 20,
      connect_timeout: 30,
    });
  }
  return sql;
}

export async function closeRdsClient() {
  if (sql) {
    await sql.end();
    sql = null;
  }
}
