// Password hashing utilities using bcrypt
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
