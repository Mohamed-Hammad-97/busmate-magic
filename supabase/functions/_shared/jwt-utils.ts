// JWT utilities for custom authentication
import { create, verify, getNumericDate, Header, Payload } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const ALGORITHM = "HS256";
const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour in seconds
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 7; // 7 days in seconds

interface TokenPayload {
  sub: string; // user_id
  email?: string;
  phone?: string;
  role?: string;
  type: "access" | "refresh";
}

async function getKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("JWT_SECRET");
  if (!secret) {
    throw new Error("JWT_SECRET not configured");
  }
  
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function generateAccessToken(payload: Omit<TokenPayload, "type">): Promise<string> {
  const key = await getKey();
  const now = Date.now();
  
  const jwtPayload: Payload = {
    ...payload,
    type: "access",
    iat: getNumericDate(0),
    exp: getNumericDate(ACCESS_TOKEN_EXPIRY),
  };

  return await create({ alg: ALGORITHM, typ: "JWT" } as Header, jwtPayload, key);
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const key = await getKey();
  
  const jwtPayload: Payload = {
    sub: userId,
    type: "refresh",
    iat: getNumericDate(0),
    exp: getNumericDate(REFRESH_TOKEN_EXPIRY),
  };

  return await create({ alg: ALGORITHM, typ: "JWT" } as Header, jwtPayload, key);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const key = await getKey();
    const payload = await verify(token, key);
    return payload as unknown as TokenPayload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

export async function generateTokens(userId: string, email?: string, phone?: string, role?: string) {
  const accessToken = await generateAccessToken({ sub: userId, email, phone, role });
  const refreshToken = await generateRefreshToken(userId);
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: ACCESS_TOKEN_EXPIRY,
    token_type: "Bearer",
  };
}
