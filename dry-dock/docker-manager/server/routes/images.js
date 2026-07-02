import { Router } from "express";
import { withDocker } from "../lib/dockerFactory.js";
import { requirePermission } from "../lib/auth.js";

export const imagesRouter = Router();
imagesRouter.use(withDocker);

const canRead = requirePermission("images.read");
const canWrite = requirePermission("images.write");

imagesRouter.get("/", canRead, async (req, res) => {
  try {
    const list = await req.docker.listImages();
    const images = list.map((img) => ({
      id: img.Id,
      shortId: img.Id.replace("sha256:", "").slice(0, 12),
      tags: img.RepoTags || [],
      size: img.Size,
      created: img.Created,
    }));
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

imagesRouter.post("/pull", canWrite, async (req, res) => {
  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: "image is required" });

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const stream = await req.docker.pull(image);
    req.docker.modem.followProgress(
      stream,
      (err) => {
        if (err) res.write(JSON.stringify({ error: err.message }) + "\n");
        res.end();
      },
      (event) => {
        res.write(JSON.stringify(event) + "\n");
      }
    );
  } catch (err) {
    res.write(JSON.stringify({ error: err.message }) + "\n");
    res.end();
  }
});

imagesRouter.delete("/:id", canWrite, async (req, res) => {
  try {
    const force = req.query.force === "true";
    await req.docker.getImage(req.params.id).remove({ force });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});
