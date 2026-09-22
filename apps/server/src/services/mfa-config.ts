import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getOrgConfigDir,
  parseIniWithSections,
  writeParsedConfigIni,
} from "@nakama/core";

const MFA_SECTION = "security";
const MFA_KEY = "mfa_encryption_key";

export async function ensureMfaEncryptionKey(orgId: string): Promise<string> {
  const path = join(getOrgConfigDir(orgId), "config.ini");
  let raw = "";
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  const parsed = parseIniWithSections(raw);
  const existing = parsed.sections[MFA_SECTION]?.[MFA_KEY];
  if (existing) {
    return existing;
  }
  const key = randomBytes(32).toString("base64url");
  const sections = {
    ...parsed.sections,
    [MFA_SECTION]: {
      ...parsed.sections[MFA_SECTION],
      [MFA_KEY]: key,
    },
  };
  await writeParsedConfigIni(parsed.global, sections, {}, path);
  return key;
}

export async function hasMfaEncryptionKey(orgId: string): Promise<boolean> {
  const path = join(getOrgConfigDir(orgId), "config.ini");
  try {
    const parsed = parseIniWithSections(await readFile(path, "utf8"));
    return Boolean(parsed.sections[MFA_SECTION]?.[MFA_KEY]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
