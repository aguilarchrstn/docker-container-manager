import { verifySession, SESSION_COOKIE } from "../lib/auth.js";
import { readCollection, writeCollection } from "../lib/store.js";
import { hashApiToken, looksLikeApiToken } from "../lib/apiTokens.js";
import { effectivePermissions, hasPermission } from "../lib/rbac.js";

// Attaches req.user (without passwordHash) and req.permissions (a Set)
// when a valid session cookie OR a valid `Authorization: Bearer ddk_...`
// API token is present. Does NOT itself reject the request — use
// requireAuth / requirePermission for that — so routes like /api/health
// can stay public.
export async function attachUser(req, res, next) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7).trim()
      : null;

    if (bearer && looksLikeApiToken(bearer)) {
      await attachFromApiToken(req, bearer);
      return next();
    }

    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return next();
    const payload = await verifySession(token);
    if (!payload) return next();

    const users = await readCollection("users", []);
    const user = users.find((u) => u.id === payload.sub);
    if (!user) return next();

    const teams = await readCollection("teams", []);
    const roles = await readCollection("roles", []);
    const { passwordHash, ...safeUser } = user;
    req.user = safeUser;
    req.permissions = effectivePermissions(user, teams, roles);
    next();
  } catch (err) {
    next(err);
  }
}

async function attachFromApiToken(req, plaintext) {
  const hash = hashApiToken(plaintext);
  const tokens = await readCollection("apiTokens", []);
  const idx = tokens.findIndex((t) => t.tokenHash === hash);
  if (idx === -1) return;

  const users = await readCollection("users", []);
  const user = users.find((u) => u.id === tokens[idx].userId);
  if (!user) return;

  const teams = await readCollection("teams", []);
  const roles = await readCollection("roles", []);
  const { passwordHash, ...safeUser } = user;
  req.user = safeUser;
  req.permissions = effectivePermissions(user, teams, roles);
  req.apiTokenId = tokens[idx].id;

  // Best-effort, fire-and-forget — a failed write here shouldn't fail the
  // actual request that's authenticating.
  tokens[idx].lastUsedAt = new Date().toISOString();
  writeCollection("apiTokens", tokens).catch(() => {});
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    if (!hasPermission(req.permissions, permission)) {
      return res.status(403).json({ error: "You don't have permission to do that." });
    }
    next();
  };
}
