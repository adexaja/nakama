import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { getOrgConfigDir, parseIniWithSections } from "@nakama/core";

const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Decode(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value
    .replace(/[=]+$/u, "")
    .replace(/\s+/gu, "")
    .toUpperCase();
  let bits = "";
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) {
      throw new Error("Invalid TOTP secret.");
    }
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function base32Encode(value: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of value) {
    bits += byte.toString(2).padStart(8, "0");
  }
  let result = "";
  for (let offset = 0; offset < bits.length; offset += 5) {
    result +=
      alphabet[
        Number.parseInt(bits.slice(offset, offset + 5).padEnd(5, "0"), 2)
      ];
  }
  return result;
}

function encryptionKey(orgId: string): Buffer {
  const path = `${getOrgConfigDir(orgId)}/config.ini`;
  let raw: string | undefined;
  try {
    raw = parseIniWithSections(readFileSync(path, "utf8")).sections.security
      ?.mfa_encryption_key;
  } catch {
    raw = undefined;
  }
  if (!raw) {
    throw new Error(
      "MFA encryption key is not configured for this organization."
    );
  }
  const key = Buffer.from(raw, "base64url");
  if (key.length !== 32) {
    throw new Error("MFA encryption key must be a 32-byte key.");
  }
  return key;
}

export function hashBackupCode(orgId: string, code: string): string {
  return createHmac("sha256", encryptionKey(orgId))
    .update(code.trim().toUpperCase())
    .digest("base64url");
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function encryptTotpSecret(orgId: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(orgId), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64url"
  );
}

export function decryptTotpSecret(orgId: string, value: string): string {
  const encoded = Buffer.from(value, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(orgId),
    encoded.subarray(0, 12)
  );
  decipher.setAuthTag(encoded.subarray(12, 28));
  return Buffer.concat([
    decipher.update(encoded.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}

export function createTotpCode(secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(message)
    .digest();
  const offset = digest[digest.length - 1] % 16;
  const code = (digest.readUInt32BE(offset) % 2_147_483_648) % 10 ** DIGITS;
  return String(code).padStart(DIGITS, "0");
}

export function verifyTotpCode(
  secret: string,
  code: string,
  timestamp = Date.now()
): boolean {
  const normalized = code.trim();
  return [-1, 0, 1].some(
    (offset) =>
      createTotpCode(secret, timestamp + offset * STEP_SECONDS * 1000) ===
      normalized
  );
}
