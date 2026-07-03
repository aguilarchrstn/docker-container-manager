import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes } from "crypto";
import { readSettings, writeSettings } from "./store.js";

export const SESSION_COOKIE = "drydock_session";

// The JWT signing secret is generated once on first boot and persisted to
// server/data/settings.json (mounted volume), so sessions survive restarts
// but a fresh install never ships with a predictable secret.
let cachedSecret;
export async function getJwtSecret() {
  if (cachedSecret) return cachedSecret;
  const settings = await readSettings();
  if (!settings.jwtSecret) {
    settings.jwtSecret = randomBytes(48).toString("hex");
    await writeSettings(settings);
  }
  cachedSecret = settings.jwtSecret;
  return cachedSecret;
}

// The agent token authenticates OTHER Dry Dock instances that add this one
// as a remote "agent" environment — separate from user login entirely.
export async function getAgentToken() {
  const settings = await readSettings();
  if (!settings.agentToken) {
    settings.agentToken = randomBytes(24).toString("hex");
    await writeSettings(settings);
  }
  return settings.agentToken;
}

export async function regenerateAgentToken() {
  const settings = await readSettings();
  settings.agentToken = randomBytes(24).toString("hex");
  await writeSettings(settings);
  return settings.agentToken;
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export async function signSession(user) {
  const secret = await getJwtSecret();
  return jwt.sign({ sub: user.id }, secret, { expiresIn: "7d" });
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
