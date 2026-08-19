import { extname, resolve, sep } from "node:path";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { type Note, NotesStore, PersistError, ValidationError } from "./notesStore.js";

export interface AppOptions {
  staticDir?: string;
  jsonLimit?: string;
}

export function createApp(
  store: NotesStore = new NotesStore(),
  options: AppOptions = {},
): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json({ limit: options.jsonLimit ?? "256kb" }));

  app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

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

  // Registered before `/api/notes/:id` so "export" is not read as a note id.
  app.get("/api/notes/export", (req: Request, res: Response) => {
    const format = parseExportFormat(req.query.format);
    if (!format) {
      res.status(400).json({ error: "format must be json or markdown" });
      return;
    }
    const notes = store.list();
    const exportedAt = new Date();
    const stamp = exportedAt.toISOString().slice(0, 10);
    if (format === "markdown") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="notes-${stamp}.md"`);
      res.send(renderMarkdown(notes, exportedAt.toISOString()));
      return;
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="notes-${stamp}.json"`);
    res.send(JSON.stringify(notes, null, 2));
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

  if (options.staticDir) {
    const staticDir = resolve(options.staticDir);
    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${sep}assets${sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        },
      }),
    );
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      // Missing hashed assets / favicons must 404, not fall back to index.html.
      if (extname(req.path)) {
        res.status(404).end();
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      res.sendFile(resolve(staticDir, "index.html"), (err) => {
        if (err) next(err);
      });
    });
  }

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
      error:
        status === 400
          ? "invalid request body"
          : status === 413
            ? "request body too large"
            : "internal server error",
    });
  });

  return app;
}

function parseExportFormat(value: unknown): "json" | "markdown" | undefined {
  if (value === undefined) {
    return "json";
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const format = value.trim().toLowerCase();
  if (format === "" || format === "json") {
    return "json";
  }
  if (format === "markdown" || format === "md") {
    return "markdown";
  }
  return undefined;
}

function renderMarkdown(notes: Note[], exportedAt: string): string {
  const lines = ["# Notes", "", `_Exported ${exportedAt}_`, ""];
  if (notes.length === 0) {
    lines.push("_No notes yet._", "");
  }
  for (const note of notes) {
    lines.push(`## ${note.title.replace(/\s+/g, " ")}`, "");
    lines.push(`_Created ${note.createdAt} · Updated ${note.updatedAt}_`, "");
    if (note.body) {
      lines.push(note.body, "");
    }
  }
  return lines.join("\n");
}

function httpStatus(err: unknown): number {
  if (typeof err === "object" && err !== null) {
    const record = err as { status?: unknown; statusCode?: unknown };
    const status = Number(record.status ?? record.statusCode);
    if (Number.isInteger(status) && status >= 400 && status < 600) {
      return status;
    }
  }
  return 500;
}
