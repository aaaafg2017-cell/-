import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { NotesStore, PersistError, ValidationError } from "./notesStore.js";

export function createApp(store: NotesStore = new NotesStore()): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    const persist = store.persistStatus();
    res.json({
      status: persist === "ok" ? "ok" : persist,
      persist,
      uptime: process.uptime(),
    });
  });

  app.get("/api/notes", (_req: Request, res: Response) => {
    res.json(store.list());
  });

  app.get("/api/notes/:id", (req: Request, res: Response) => {
    const note = store.get(req.params.id);
    if (!note) {
      res.status(404).json({ error: "note not found" });
      return;
    }
    res.json(note);
  });

  app.post("/api/notes", (req: Request, res: Response) => {
    const { title, body } = req.body ?? {};
    const note = store.create({ title, body });
    res.status(201).json(note);
  });

  app.put("/api/notes/:id", (req: Request, res: Response) => {
    const body = req.body ?? {};
    const patch: { title?: unknown; body?: unknown } = {};
    if (body && typeof body === "object" && "title" in body) {
      patch.title = body.title;
    }
    if (body && typeof body === "object" && "body" in body) {
      patch.body = body.body;
    }
    const note = store.update(req.params.id, patch);
    if (!note) {
      res.status(404).json({ error: "note not found" });
      return;
    }
    res.json(note);
  });

  app.delete("/api/notes/:id", (req: Request, res: Response) => {
    const deleted = store.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "note not found" });
      return;
    }
    res.status(204).end();
  });

  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "not found" });
  });

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof PersistError) {
      res.status(503).json({ error: err.message });
      return;
    }
    const status = httpStatus(err);
    if (status >= 500) {
      console.error(err);
    }
    res.status(status).json({
      error: status === 400 ? "invalid request body" : "internal server error",
    });
  });

  return app;
}

function httpStatus(err: unknown): number {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = Number((err as { status?: unknown }).status);
    if (Number.isInteger(status) && status >= 400 && status < 600) {
      return status;
    }
  }
  return 500;
}
