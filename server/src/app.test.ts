import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { BODY_MAX_LENGTH, NotesStore, TITLE_MAX_LENGTH } from "./notesStore.js";

let app: ReturnType<typeof createApp>;
let store: NotesStore;

beforeEach(() => {
  store = new NotesStore();
  app = createApp(store);
});

describe("Notes API", () => {
  it("reports health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.persist).toBe("ok");
    expect(res.headers["cache-control"]).toMatch(/no-store/i);
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("starts with no notes", async () => {
    const res = await request(app).get("/api/notes");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(res.headers["cache-control"]).toMatch(/no-store/i);
  });

  it("creates a note", async () => {
    const res = await request(app)
      .post("/api/notes")
      .send({ title: "First note", body: "hello world" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "First note", body: "hello world" });
    expect(res.body.id).toBeTruthy();
    expect(res.body.updatedAt).toBeTruthy();
  });

  it("rejects a note without a title", async () => {
    const res = await request(app).post("/api/notes").send({ body: "no title" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it("treats a non-string body as empty", async () => {
    const res = await request(app)
      .post("/api/notes")
      .send({ title: "numeric body", body: 123 });
    expect(res.status).toBe(201);
    expect(res.body.body).toBe("");
  });

  it("rejects a title that is too long", async () => {
    const res = await request(app)
      .post("/api/notes")
      .send({ title: "x".repeat(TITLE_MAX_LENGTH + 1) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most/);
  });

  it("rejects a body that is too long", async () => {
    const res = await request(app)
      .post("/api/notes")
      .send({ title: "ok", body: "y".repeat(BODY_MAX_LENGTH + 1) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most/);
  });

  it("returns 400 JSON when the body is not valid JSON", async () => {
    const res = await request(app)
      .post("/api/notes")
      .set("Content-Type", "application/json")
      .send("{");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid request body");
  });

  it("returns 413 JSON when the body exceeds the parser limit", async () => {
    const tiny = createApp(new NotesStore(), { jsonLimit: "50b" });
    const res = await request(tiny)
      .post("/api/notes")
      .send({ title: "this payload is definitely bigger than fifty bytes" });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("request body too large");
  });

  it("lists created notes newest first", async () => {
    await request(app).post("/api/notes").send({ title: "older" });
    await new Promise((r) => setTimeout(r, 5));
    await request(app).post("/api/notes").send({ title: "newer" });

    const res = await request(app).get("/api/notes");
    expect(res.body.map((n: { title: string }) => n.title)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("sorts an edited note to the top", async () => {
    const older = await request(app).post("/api/notes").send({ title: "older" });
    await new Promise((r) => setTimeout(r, 5));
    await request(app).post("/api/notes").send({ title: "newer" });
    await new Promise((r) => setTimeout(r, 5));
    await request(app)
      .put(`/api/notes/${older.body.id}`)
      .send({ title: "older edited" });

    const res = await request(app).get("/api/notes");
    expect(res.body.map((n: { title: string }) => n.title)).toEqual([
      "older edited",
      "newer",
    ]);
  });

  it("exports notes as a JSON attachment", async () => {
    await request(app)
      .post("/api/notes")
      .send({ title: "Buy milk", body: "2 liters" });

    const res = await request(app).get("/api/notes/export");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.headers["content-disposition"]).toMatch(
      /attachment; filename="notes-\d{4}-\d{2}-\d{2}\.json"/,
    );
    expect(res.body.count).toBe(1);
    expect(res.body.notes).toEqual([
      expect.objectContaining({ title: "Buy milk", body: "2 liters" }),
    ]);
    expect(res.body.exportedAt).toBeTruthy();
  });

  it("exports notes as Markdown", async () => {
    await request(app)
      .post("/api/notes")
      .send({ title: "Walk dog", body: "evening" });

    const res = await request(app).get("/api/notes/export?format=md");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/markdown/);
    expect(res.headers["content-disposition"]).toMatch(/notes-\d{4}-\d{2}-\d{2}\.md/);
    expect(res.text).toContain("# Notes");
    expect(res.text).toContain("## Walk dog");
    expect(res.text).toContain("evening");
    expect(res.text).toContain("Count: 1");
  });

  it("rejects an unknown export format", async () => {
    const res = await request(app).get("/api/notes/export?format=csv");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/json or md/);
  });

  it("does not treat export as a note id", async () => {
    const res = await request(app).get("/api/notes/export");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ count: 0, notes: [] });
  });

  it("fetches a single note", async () => {
    const created = await request(app)
      .post("/api/notes")
      .send({ title: "one", body: "body" });
    const res = await request(app).get(`/api/notes/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "one", body: "body" });
  });

  it("returns 404 when a note is missing", async () => {
    const res = await request(app).get("/api/notes/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("note not found");
  });

  it("updates a note", async () => {
    const created = await request(app)
      .post("/api/notes")
      .send({ title: "old title", body: "old body" });
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ title: "new title", body: "new body" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "new title", body: "new body" });
    expect(res.body.updatedAt).not.toBe(created.body.updatedAt);
  });

  it("keeps the existing body when PUT omits it", async () => {
    const created = await request(app)
      .post("/api/notes")
      .send({ title: "keep body", body: "original" });
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ title: "renamed" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "renamed", body: "original" });
  });

  it("clears the body when PUT sends an empty string", async () => {
    const created = await request(app)
      .post("/api/notes")
      .send({ title: "has body", body: "gone soon" });
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ body: "   " });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "has body", body: "" });
  });

  it("rejects an empty PUT patch", async () => {
    const created = await request(app)
      .post("/api/notes")
      .send({ title: "untouched" });
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title or body/);
  });

  it("does not mark a note edited when PUT repeats the same fields", async () => {
    const created = await request(app)
      .post("/api/notes")
      .send({ title: "same", body: "body" });
    const res = await request(app)
      .put(`/api/notes/${created.body.id}`)
      .send({ title: "same", body: " body " });
    expect(res.status).toBe(200);
    expect(res.body.updatedAt).toBe(created.body.updatedAt);
    expect(res.body).toMatchObject({ title: "same", body: "body" });
  });

  it("returns 404 when updating a missing note", async () => {
    const res = await request(app)
      .put("/api/notes/does-not-exist")
      .send({ title: "gone" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("note not found");
  });

  it("deletes a note", async () => {
    const created = await request(app)
      .post("/api/notes")
      .send({ title: "delete me" });
    const del = await request(app).delete(`/api/notes/${created.body.id}`);
    expect(del.status).toBe(204);

    const res = await request(app).get("/api/notes");
    expect(res.body).toEqual([]);
  });

  it("returns 404 JSON when deleting a missing note", async () => {
    const del = await request(app).delete("/api/notes/does-not-exist");
    expect(del.status).toBe(404);
    expect(del.body.error).toBe("note not found");
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not found");
  });

  it("lists valid notes and rejects writes when some records are invalid", async () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      writeFileSync(
        file,
        JSON.stringify([
          {
            id: "ok",
            title: "good",
            body: "",
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
          { not: "a note" },
        ]),
        "utf8",
      );
      vi.spyOn(console, "error").mockImplementation(() => {});
      const persisted = createApp(new NotesStore(file));

      const list = await request(persisted).get("/api/notes");
      expect(list.status).toBe(200);
      expect(list.body).toEqual([
        {
          id: "ok",
          title: "good",
          body: "",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ]);

      const health = await request(persisted).get("/api/health");
      expect(health.status).toBe(200);
      expect(health.body.persist).toBe("degraded");
      expect(health.body.status).toBe("degraded");

      const res = await request(persisted)
        .post("/api/notes")
        .send({ title: "x" });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/invalid records/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns 503 when the data file is corrupt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      writeFileSync(file, "{not json", "utf8");
      vi.spyOn(console, "error").mockImplementation(() => {});
      const persisted = createApp(new NotesStore(file));
      const list = await request(persisted).get("/api/notes");
      expect(list.status).toBe(503);
      expect(list.body.error).toMatch(/could not be loaded/);

      const exported = await request(persisted).get("/api/notes/export");
      expect(exported.status).toBe(503);

      const missing = await request(persisted).get("/api/notes/any-id");
      expect(missing.status).toBe(503);

      const health = await request(persisted).get("/api/health");
      expect(health.status).toBe(200);
      expect(health.body.persist).toBe("unavailable");
      expect(health.body.status).toBe("unavailable");

      const res = await request(persisted)
        .post("/api/notes")
        .send({ title: "x" });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/refusing to overwrite/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("serves the built client when staticDir is set", async () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-static-"));
    try {
      writeFileSync(
        join(dir, "index.html"),
        "<!doctype html><title>Notes UI</title>",
        "utf8",
      );
      mkdirSync(join(dir, "assets"));
      writeFileSync(join(dir, "assets", "app.js"), "console.log('ok');", "utf8");
      const ui = createApp(new NotesStore(), { staticDir: dir });

      const home = await request(ui).get("/");
      expect(home.status).toBe(200);
      expect(home.text).toContain("Notes UI");
      expect(home.headers["cache-control"]).toMatch(/no-store/i);

      const spa = await request(ui).get("/does-not-exist");
      expect(spa.status).toBe(200);
      expect(spa.text).toContain("Notes UI");
      expect(spa.headers["cache-control"]).toMatch(/no-store/i);

      const hashed = await request(ui).get("/assets/app.js");
      expect(hashed.status).toBe(200);
      expect(hashed.headers["cache-control"]).toMatch(/immutable/i);

      const missingAsset = await request(ui).get("/assets/missing.js");
      expect(missingAsset.status).toBe(404);

      const missingIcon = await request(ui).get("/favicon.ico");
      expect(missingIcon.status).toBe(404);

      const health = await request(ui).get("/api/health");
      expect(health.status).toBe(200);
      expect(health.body.status).toBe("ok");

      const missingApi = await request(ui).get("/api/does-not-exist");
      expect(missingApi.status).toBe(404);
      expect(missingApi.body.error).toBe("not found");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
