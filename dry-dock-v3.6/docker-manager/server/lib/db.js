import pg from "pg";
import { logger } from "./logger.js";

const { Pool } = pg;

// Dry Dock's own data (users, teams, roles, environments, settings,
// activity, theme, presets) is small and document-shaped — every existing
// call site already treats it as "read the whole named collection as
// JSON, write the whole named collection as JSON". Rather than designing
// a relational schema per entity (a lot of migration risk for no real
// benefit at this scale), Postgres support mirrors that exact shape: one
// table, one JSONB column, keyed by collection name. This is what lets
// store.js swap backends without every route file (users.js, teams.js,
// etc.) needing to change at all.

let pool = null;

export function isDatabaseConfigured() {
  return !!(process.env.DATABASE_URL || process.env.PG_HOST);
}

export function getPool() {
  if (pool) return pool;
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  } else {
    pool = new Pool({
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT) || 5432,
      user: process.env.PG_USER || "drydock",
      password: process.env.PG_PASSWORD || "",
      database: process.env.PG_DATABASE || "drydock",
    });
  }
  pool.on("error", (err) => {
    // A dropped idle connection shouldn't crash the process — the pool
    // reconnects on next use. Just log it.
    logger.error("Postgres pool error", { error: err.message });
  });
  return pool;
}

let schemaReady = null;

export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = getPool().query(`
    CREATE TABLE IF NOT EXISTS dry_dock_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await schemaReady;
  logger.info("Connected to PostgreSQL — using it for Dry Dock's own data instead of JSON files.");
  return schemaReady;
}

export async function dbGet(key, fallback) {
  const result = await getPool().query("SELECT value FROM dry_dock_store WHERE key = $1", [key]);
  if (result.rows.length === 0) return fallback;
  return result.rows[0].value;
}

export async function dbSet(key, value) {
  await getPool().query(
    `INSERT INTO dry_dock_store (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
  return value;
}

export async function assertDatabaseReachable() {
  try {
    await getPool().query("SELECT 1");
    return true;
  } catch (err) {
    logger.error(
      "Could not reach PostgreSQL — check DATABASE_URL (or PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE) and that the database is running.",
      { error: err.message }
    );
    return false;
  }
}

// A Postgres container being "started" (what plain `depends_on:` in
// Compose waits for) is not the same as it being ready to accept
// connections — Postgres does its own init work for a few seconds after
// the process starts. Without this retry, Dry Dock would try to connect
// immediately on boot, fail, and crash before Postgres was ever actually
// ready — a startup race, not a real configuration problem. Retries with
// backoff instead of failing on the first attempt.
export async function waitForDatabase({ attempts = 10, delayMs = 2000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await getPool().query("SELECT 1");
      return true;
    } catch (err) {
      if (i === attempts) {
        logger.error(
          `Could not reach PostgreSQL after ${attempts} attempts — check DATABASE_URL (or PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE) and that the database is running.`,
          { error: err.message }
        );
        return false;
      }
      logger.info(`Waiting for PostgreSQL… (attempt ${i}/${attempts})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}
