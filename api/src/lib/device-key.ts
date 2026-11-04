import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function generateKey(): string {
  return randomBytes(32).toString("base64url");
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function keyMatches(key: string, hash: string): boolean {
  const a = Buffer.from(hashKey(key));
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
