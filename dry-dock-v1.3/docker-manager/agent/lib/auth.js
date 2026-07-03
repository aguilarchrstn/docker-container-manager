// Guards every /api/agent/* route with a shared secret (x-agent-token),
// same contract the full Dry Dock manager's built-in agent surface uses —
// which is what lets a manager's "Self-hosted Dry Dock manager" /
// "Dry Dock Agent" environment type point at either one interchangeably.
export function requireAgentToken(req, res, next) {
  const expected = process.env.AGENT_TOKEN;
  if (!expected) {
    return res.status(500).json({
      error: "This agent has no AGENT_TOKEN configured — set one and restart the container.",
    });
  }
  const provided = req.headers["x-agent-token"];
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: "Invalid or missing agent token" });
  }
  next();
}

// The manager appends ?env=<id> so it can address one of ITS OWN nodes
// when proxying through another full manager. This standalone agent only
// ever has one node — itself — so the param is accepted and ignored.
export function resolveEnvironment(req, res, next) {
  req.environment = { id: "local" };
  next();
}
