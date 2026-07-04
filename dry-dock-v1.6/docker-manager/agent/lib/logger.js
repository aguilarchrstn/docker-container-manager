// A deliberately small logger — Dry Dock doesn't need a logging framework,
// just something that respects LOG_LEVEL/LOG_JSON so the Compose
// Generator's "Runtime" step does something real.

const LEVELS = ["silent", "error", "warn", "info", "debug"];

function currentLevelIndex() {
  const level = (process.env.LOG_LEVEL || "info").toLowerCase();
  const idx = LEVELS.indexOf(level);
  return idx === -1 ? LEVELS.indexOf("info") : idx;
}

function isJson() {
  return String(process.env.LOG_JSON || "false").toLowerCase() === "true";
}

function emit(level, message, meta) {
  if (LEVELS.indexOf(level) > currentLevelIndex()) return;
  if (isJson()) {
    console.log(JSON.stringify({ level, time: new Date().toISOString(), message, ...meta }));
  } else {
    const prefix = `[${level}]`;
    meta ? console.log(prefix, message, meta) : console.log(prefix, message);
  }
}

export const logger = {
  error: (message, meta) => emit("error", message, meta),
  warn: (message, meta) => emit("warn", message, meta),
  info: (message, meta) => emit("info", message, meta),
  debug: (message, meta) => emit("debug", message, meta),
};

// Logs each request at "info" (method, path, status, duration) — skipped
// entirely if LOG_LEVEL=silent or below "info".
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.path} ${res.statusCode}`, {
      durationMs: Date.now() - start,
    });
  });
  next();
}
