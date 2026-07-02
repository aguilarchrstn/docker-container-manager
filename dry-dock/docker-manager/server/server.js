import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import "./lib/db.js"; // triggers schema + seed
import { requireAuth } from "./lib/auth.js";
import { pingEnv } from "./lib/dockerFactory.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { environmentsRouter } from "./routes/environments.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { containersRouter } from "./routes/containers.js";
import { imagesRouter } from "./routes/images.js";
import { themeRouter } from "./routes/theme.js";
import { presetsRouter } from "./routes/presets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Public endpoints
app.use("/api/auth", authRouter);
app.get("/api/health", async (req, res) => {
  const result = await pingEnv();
  res.json({ ok: result.ok });
});

// Everything else requires authentication.
app.use("/api", requireAuth);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/environments", environmentsRouter);
app.use("/api/containers", containersRouter);
app.use("/api/images", imagesRouter);
// Theme / presets: reads allowed to any signed-in user, writes gated in the router.
app.use("/api/theme", themeRouter);
app.use("/api/presets", presetsRouter);
app.use("/api/admin", adminRouter);

// Serve the built React client in production.
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, async () => {
  console.log(`dry-dock server listening on :${PORT}`);
  const result = await pingEnv();
  if (!result.ok) {
    console.warn(`[dry-dock] Default environment not reachable: ${result.error}`);
  }
});
