import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { containersRouter } from "./routes/containers.js";
import { imagesRouter } from "./routes/images.js";
import { themeRouter } from "./routes/theme.js";
import { presetsRouter } from "./routes/presets.js";
import { assertDockerReachable } from "./lib/docker.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/containers", containersRouter);
app.use("/api/images", imagesRouter);
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
  console.log(`docker-manager server listening on :${PORT}`);
  await assertDockerReachable();
});
