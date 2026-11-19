import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const HEX = /^(?:[0-9a-f]{2})+$/;

/** Hash scrypt com sal aleatório, no formato `scrypt$<sal>$<hash>` (hexadecimal). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt, KEY_BYTES);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** Confere a senha em tempo constante. Hash malformado nunca confere e nunca lança. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex, extra] = stored.split("$");
  if (scheme !== "scrypt" || extra !== undefined) return false;
  if (!saltHex || !hashHex || !HEX.test(saltHex) || !HEX.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(
    password,
    Buffer.from(saltHex, "hex"),
    expected.length,
  );
  return timingSafeEqual(actual, expected);
}
