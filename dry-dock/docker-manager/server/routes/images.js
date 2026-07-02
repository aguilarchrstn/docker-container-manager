import { Router } from "express";
import { docker } from "../lib/docker.js";

export const imagesRouter = Router();

imagesRouter.get("/", async (req, res) => {
  try {
    const list = await docker.listImages();
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

// Pulls an image and streams progress as newline-delimited JSON so the UI
// can show a live progress log. Body: { "image": "nginx:latest" }
imagesRouter.post("/pull", async (req, res) => {
  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: "image is required" });

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Transfer-Encoding", "chunked");

  try {
    const stream = await docker.pull(image);
    docker.modem.followProgress(
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

imagesRouter.delete("/:id", async (req, res) => {
  try {
    const force = req.query.force === "true";
    await docker.getImage(req.params.id).remove({ force });
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});
