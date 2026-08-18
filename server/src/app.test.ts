import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { NotesStore } from "./notesStore.js";

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
  });

  it("rejects a note without a title", async () => {
    const res = await request(app).post("/api/notes").send({ body: "no title" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
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

  it("deletes a note", async () => {
    const created = await request(app)
      .post("/api/notes")
      .send({ title: "delete me" });
    const del = await request(app).delete(`/api/notes/${created.body.id}`);
    expect(del.status).toBe(204);

    const res = await request(app).get("/api/notes");
    expect(res.body).toEqual([]);
  });

  it("returns 404 when deleting a missing note", async () => {
    const del = await request(app).delete("/api/notes/does-not-exist");
    expect(del.status).toBe(404);
  });
});
