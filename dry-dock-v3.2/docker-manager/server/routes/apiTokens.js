import { Router } from "express";
import { readCollection, writeCollection } from "../lib/store.js";
import { requireAuth } from "../middleware/auth.js";
import { newId } from "../lib/auth.js";
import { generateApiToken } from "../lib/apiTokens.js";
import { logActivity } from "../lib/activity.js";

export const apiTokensRouter = Router();

apiTokensRouter.use(requireAuth);

function sanitize(t) {
  const { tokenHash, ...rest } = t;
  return rest;
}

// Only ever your own tokens — there's no admin view of everyone else's
// tokens by design, same as GitHub/GitLab personal access tokens.
apiTokensRouter.get("/", async (req, res) => {
  try {
    const tokens = await readCollection("apiTokens", []);
    const mine = tokens.filter((t) => t.userId === req.user.id);
    res.json({ tokens: mine.map(sanitize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiTokensRouter.post("/", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "Give this token a name" });

    const { plaintext, hash, preview } = generateApiToken();
    const tokens = await readCollection("apiTokens", []);
    const record = {
      id: newId("tok"),
      userId: req.user.id,
      name: name.trim(),
      tokenHash: hash,
      preview,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    };
    tokens.push(record);
    await writeCollection("apiTokens", tokens);
    await logActivity({
      actorId: req.user.id,
      actorName: req.user.username,
      action: `Created API token "${record.name}"`,
      success: true,
    });

    // The only time the plaintext value is ever available — not
    // recoverable after this response.
    res.status(201).json({ token: sanitize(record), plaintext });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiTokensRouter.delete("/:id", async (req, res) => {
  try {
    const tokens = await readCollection("apiTokens", []);
    const target = tokens.find((t) => t.id === req.params.id);
    if (!target || target.userId !== req.user.id) {
      return res.status(404).json({ error: "Token not found" });
    }
    const next = tokens.filter((t) => t.id !== req.params.id);
    await writeCollection("apiTokens", next);
    await logActivity({
      actorId: req.user.id,
      actorName: req.user.username,
      action: `Revoked API token "${target.name}"`,
      success: true,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
