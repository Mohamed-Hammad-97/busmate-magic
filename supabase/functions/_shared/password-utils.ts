// Password hashing utilities using Web Crypto API (no Worker dependency)

async function pbkdf2Hash(password: string, salt: Uint8Array, iterations: number = 100000): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, "0")).join("");

  return `pbkdf2:${iterations}:${saltHex}:${hashHex}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return pbkdf2Hash(password, salt);
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Support legacy bcrypt hashes (start with $2)
  if (storedHash.startsWith("$2")) {
    // bcrypt Worker issue in edge runtime - use hashSync/compareSync from bcrypt
    try {
      const bcrypt = await import("https://deno.land/x/bcrypt@v0.4.1/src/worker.ts");
      return await bcrypt.compare(password, storedHash);
    } catch {
      // If Worker-based bcrypt fails, try the sync fallback
      try {
        const { compareSync } = await import("https://deno.land/x/bcrypt@v0.4.1/src/main.ts");
        return compareSync(password, storedHash);
      } catch {
        return false;
      }
    }
  }

  // PBKDF2 format: pbkdf2:iterations:saltHex:hashHex
  if (storedHash.startsWith("pbkdf2:")) {
    const parts = storedHash.split(":");
    if (parts.length !== 4) return false;

    const iterations = parseInt(parts[1]);
    const saltHex = parts[2];
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));

    const newHash = await pbkdf2Hash(password, salt, iterations);
    return newHash === storedHash;
  }

  return false;
}
