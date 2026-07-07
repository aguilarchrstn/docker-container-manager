import { getEngine } from "./dockerPool.js";

// Registers Docker volume routes on `router`. Same dual-use pattern as
// containerHandlers.js — used by the manager's user-facing router (with
// session auth + permission guards) and the agent's machine-to-machine
// router (with a single shared-secret guard).
export function registerVolumeRoutes(router, { viewGuards = [], manageGuards = [] } = {}) {
  router.get("/", ...viewGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const { Volumes } = await docker.listVolumes();
      const volumes = (Volumes || []).map((v) => ({
        name: v.Name,
        driver: v.Driver,
        mountpoint: v.Mountpoint,
        created: v.CreatedAt,
        labels: v.Labels || {},
        scope: v.Scope,
      }));
      res.json({ volumes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/:name", ...viewGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const info = await docker.getVolume(req.params.name).inspect();
      res.json({ volume: info });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post("/", ...manageGuards, async (req, res) => {
    try {
      const { name, driver = "local", labels = {} } = req.body || {};
      const docker = await getEngine(req.environment.id);
      const opts = { Driver: driver, Labels: labels };
      if (name?.trim()) opts.Name = name.trim();
      const volume = await docker.createVolume(opts);
      res.status(201).json({ volume });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.delete("/:name", ...manageGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const force = req.query.force === "true";
      await docker.getVolume(req.params.name).remove({ force });
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });
}

// Registers Docker network routes. Same pattern as above.
export function registerNetworkRoutes(router, { viewGuards = [], manageGuards = [] } = {}) {
  router.get("/", ...viewGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const list = await docker.listNetworks();
      const networks = list.map((n) => ({
        id: n.Id,
        shortId: n.Id.slice(0, 12),
        name: n.Name,
        driver: n.Driver,
        scope: n.Scope,
        internal: n.Internal,
        attachable: n.Attachable,
        created: n.Created,
        subnet: n.IPAM?.Config?.[0]?.Subnet || null,
        containerCount: Object.keys(n.Containers || {}).length,
      }));
      res.json({ networks });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/:id", ...viewGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      const info = await docker.getNetwork(req.params.id).inspect();
      res.json({ network: info });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.post("/", ...manageGuards, async (req, res) => {
    try {
      const { name, driver = "bridge", internal = false, attachable = true, subnet } = req.body || {};
      if (!name?.trim()) return res.status(400).json({ error: "name is required" });
      const docker = await getEngine(req.environment.id);
      const opts = {
        Name: name.trim(),
        Driver: driver,
        Internal: !!internal,
        Attachable: !!attachable,
      };
      if (subnet?.trim()) {
        opts.IPAM = { Config: [{ Subnet: subnet.trim() }] };
      }
      const network = await docker.createNetwork(opts);
      res.status(201).json({ id: network.id });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });

  router.delete("/:id", ...manageGuards, async (req, res) => {
    try {
      const docker = await getEngine(req.environment.id);
      await docker.getNetwork(req.params.id).remove();
      res.json({ ok: true });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  });
}
