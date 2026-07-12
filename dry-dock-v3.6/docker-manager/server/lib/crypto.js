import crypto from "crypto";

// Optional layer: if ENCRYPTION_KEY isn't set, encryptAtRest/decryptAtRest
// are no-ops and everything behaves exactly as it did before this existed
// (plaintext in server/data/settings.json or the database, same as
// JWT_SECRET/AGENT_TOKEN always worked). Set ENCRYPTION_KEY and newly
// persisted secrets (the auto-generated JWT signing secret and agent
// token, specifically — see auth.js) get encrypted before they're written.
//
// This intentionally does NOT try to retroactively encrypt everything
// already on disk, and does not touch values you've pinned yourself via
// JWT_SECRET/AGENT_TOKEN env vars (those are never persisted at all,
// encrypted or not — they're read fresh from the environment every time).

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function deriveKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;
  // Accepts any string — hashed down to a proper 32-byte AES-256 key
  // rather than requiring the operator to paste an exact-length hex key.
  return crypto.createHash("sha256").update(raw, "utf-8").digest();
}

export function encryptionEnabled() {
  return !!process.env.ENCRYPTION_KEY;
}

export function encryptAtRest(plain) {
  const key = deriveKey();
  if (!key || plain == null) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plain), "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptAtRest(value) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value; // plaintext / not our format
  const key = deriveKey();
  if (!key) {
    throw new Error(
      "This value was encrypted with an ENCRYPTION_KEY that isn't set — set the same ENCRYPTION_KEY to read it back."
    );
  }
  const [ivHex, tagHex, dataHex] = value.slice(PREFIX.length).split(":");
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf-8");
}
