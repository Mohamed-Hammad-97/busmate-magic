// Shared RDS PostgreSQL client for Edge Functions
import postgres from "postgres";

export function getRdsClient() {
  const host = Deno.env.get("RDS_HOST");
  const user = Deno.env.get("RDS_USER");
  const password = Deno.env.get("RDS_PASSWORD");
  const database = Deno.env.get("RDS_DATABASE");

  console.log("RDS Config - Host:", host ? "SET" : "NOT SET");
  console.log("RDS Config - User:", user ? "SET" : "NOT SET");
  console.log("RDS Config - Database:", database ? "SET" : "NOT SET");
  console.log("RDS Config - Password:", password ? "SET" : "NOT SET");

  if (!host || !user || !password || !database) {
    throw new Error(`RDS connection environment variables not configured. Host: ${!!host}, User: ${!!user}, DB: ${!!database}, Pass: ${!!password}`);
  }

  const sql = postgres({
    host,
    port: 5432,
    database,
    username: user,
    password,
    ssl: "require",
    max: 1,
    idle_timeout: 10,
    connect_timeout: 30,
  });
  
  return sql;
}
