import { Router } from "express";
import { randomUUID } from "crypto";
import { readPresets, writePresets } from "../lib/store.js";

export const presetsRouter = Router();

presetsRouter.get("/", async (req, res) => {
  try {
    const presets = await readPresets();
    res.json({ presets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

presetsRouter.post("/", async (req, res) => {
  try {
    const { name, colors } = req.body || {};
    if (!name || !name.trim() || !colors) {
      return res.status(400).json({ error: "name and colors are required" });
    }
    const presets = await readPresets();
    const preset = { id: randomUUID(), name: name.trim(), colors };
    presets.push(preset);
    await writePresets(presets);
    res.status(201).json({ preset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

presetsRouter.put("/:id", async (req, res) => {
  try {
    const { name, colors } = req.body || {};
    const presets = await readPresets();
    const idx = presets.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Preset not found" });
    presets[idx] = {
      ...presets[idx],
      name: name?.trim() || presets[idx].name,
      colors: colors || presets[idx].colors,
    };
    await writePresets(presets);
    res.json({ preset: presets[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

presetsRouter.delete("/:id", async (req, res) => {
  try {
    const presets = await readPresets();
    const next = presets.filter((p) => p.id !== req.params.id);
    await writePresets(next);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
