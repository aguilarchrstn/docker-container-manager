import crypto from "crypto";

const PREFIX = "ddk_";

// Tokens are high-entropy random strings, not user-chosen passwords, so a
// fast SHA-256 hash is the right tool here (unlike bcrypt for passwords,
// which is deliberately slow to resist brute-forcing a small keyspace of
// human-chosen secrets — that concern doesn't apply to a 256-bit random
// token). Only the hash is ever stored; the plaintext is shown once, at
// creation, and never again.
export function generateApiToken() {
  const plaintext = `${PREFIX}${crypto.randomBytes(32).toString("hex")}`;
  return { plaintext, hash: hashApiToken(plaintext), preview: previewToken(plaintext) };
}

export function hashApiToken(plaintext) {
  return crypto.createHash("sha256").update(plaintext, "utf-8").digest("hex");
}

// A short, non-sensitive fragment shown in the token list so someone can
// tell tokens apart without the full value ever being stored or shown
// again — same idea as GitHub's "ghp_1a2b...".
export function previewToken(plaintext) {
  return `${plaintext.slice(0, 8)}…${plaintext.slice(-4)}`;
}

export function looksLikeApiToken(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}
