import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import { containersRouter } from "./routes/containers.js";
import { imagesRouter } from "./routes/images.js";
import { themeRouter } from "./routes/theme.js";
import { presetsRouter } from "./routes/presets.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { teamsRouter } from "./routes/teams.js";
import { rolesRouter } from "./routes/roles.js";
import { environmentsRouter } from "./routes/environments.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { agentRouter } from "./routes/agent.js";
import { stacksRouter } from "./routes/stacks.js";
import { activityRouter } from "./routes/activity.js";
import { settingsRouter } from "./routes/settings.js";
import { assertDockerReachable } from "./lib/docker.js";
import { attachUser } from "./middleware/auth.js";
import { activityLogger } from "./middleware/activityLogger.js";
import { seedDefaults } from "./lib/seed.js";
import { pruneActivityNow } from "./lib/activity.js";
import { requestLogger, logger } from "./lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
app.use(attachUser);
app.use(activityLogger);

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/teams", teamsRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/environments", environmentsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/agent", agentRouter);
app.use("/api/activity", activityRouter);
app.use("/api/settings", settingsRouter);

app.use("/api/containers", containersRouter);
app.use("/api/images", imagesRouter);
app.use("/api/stacks", stacksRouter);
app.use("/api/theme", themeRouter);
app.use("/api/presets", presetsRouter);

app.get("/api/health", async (req, res) => {
  const ok = await assertDockerReachable();
  res.json({ ok });
});

// Serve the built React client in production
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, async () => {
  logger.info(`Dry Dock server listening on :${PORT}`);
  await seedDefaults();
  await assertDockerReachable();
  await pruneActivityNow();
  setInterval(() => pruneActivityNow().catch((err) => logger.error("Activity prune failed", { err: err.message })), 60 * 60 * 1000);
  logger.info("First-boot defaults ready — log in with admin / admin (you'll be asked to change it).");
});
