import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes } from "crypto";
import { readSettings, writeSettings } from "./store.js";
import { encryptAtRest, decryptAtRest } from "./crypto.js";

export const SESSION_COOKIE = "drydock_session";

// The JWT signing secret is, in order of preference: an operator-provided
// JWT_SECRET env var (set this if you want sessions to survive a full
// volume wipe/redeploy, or if you're running more than one Dry Dock
// replica behind a load balancer), or one generated once on first boot and
// persisted to server/data/settings.json — encrypted at rest if
// ENCRYPTION_KEY is set (see crypto.js), plaintext otherwise (unchanged
// from how this always worked).
let cachedSecret;
export async function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;
  const settings = await readSettings();
  if (!settings.jwtSecret) {
    settings.jwtSecret = encryptAtRest(randomBytes(48).toString("hex"));
    await writeSettings(settings);
  }
  cachedSecret = decryptAtRest(settings.jwtSecret);
  return cachedSecret;
}

// Same idea for the agent token — set AGENT_TOKEN yourself if you want a
// predictable value to hand out when wiring up remote nodes/managers
// (handy for provisioning several boxes from one Compose file), otherwise
// one is generated and persisted on first boot.
export async function getAgentToken() {
  if (process.env.AGENT_TOKEN) return process.env.AGENT_TOKEN;
  const settings = await readSettings();
  if (!settings.agentToken) {
    settings.agentToken = encryptAtRest(randomBytes(24).toString("hex"));
    await writeSettings(settings);
  }
  return decryptAtRest(settings.agentToken);
}

export async function regenerateAgentToken() {
  if (process.env.AGENT_TOKEN) {
    throw new Error("AGENT_TOKEN is set via environment variable — change it there and restart instead.");
  }
  const settings = await readSettings();
  settings.agentToken = encryptAtRest(randomBytes(24).toString("hex"));
  await writeSettings(settings);
  return decryptAtRest(settings.agentToken);
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function signSession(user) {
  const secret = await getJwtSecret();
  const settings = await readSettings();
  const days = settings.sessionDurationDays ?? 7;
  return jwt.sign({ sub: user.id }, secret, { expiresIn: `${days}d` });
}

export async function getSessionDurationMs() {
  const settings = await readSettings();
  const days = settings.sessionDurationDays ?? 7;
  return days * 24 * 60 * 60 * 1000;
}

export async function verifySession(token) {
  const secret = await getJwtSecret();
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

export function newId(prefix) {
  return `${prefix}-${randomUUID()}`;
}
