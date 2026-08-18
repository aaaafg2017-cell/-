import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  });

  it("starts with no notes", async () => {
    const res = await request(app).get("/api/notes");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
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

  it("returns 503 when the data file is corrupt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "notes-"));
    const file = join(dir, "notes.json");
    try {
      writeFileSync(file, "{not json", "utf8");
      vi.spyOn(console, "error").mockImplementation(() => {});
      const persisted = createApp(new NotesStore(file));
      const res = await request(persisted)
        .post("/api/notes")
        .send({ title: "x" });
      expect(res.status).toBe(503);
      expect(res.body.error).toMatch(/refusing to overwrite/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
