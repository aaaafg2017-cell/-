import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import { NotesStore, ValidationError } from "./notesStore.js";

export function createApp(store: NotesStore = new NotesStore()): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/api/notes", (_req: Request, res: Response) => {
    res.json(store.list());
  });

  app.post("/api/notes", (req: Request, res: Response) => {
    try {
      const { title, body } = req.body ?? {};
      const note = store.create({ title, body });
      res.status(201).json(note);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  });

  app.delete("/api/notes/:id", (req: Request, res: Response) => {
    const deleted = store.delete(req.params.id);
    res.status(deleted ? 204 : 404).end();
  });

  app.use((err: unknown, _req: Request, res: Response, next: (e?: unknown) => void) => {
    console.error(err);
    if (res.headersSent) {
      next(err);
      return;
    }
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
