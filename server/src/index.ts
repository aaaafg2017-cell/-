import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { NotesStore } from "./notesStore.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_FILE = resolve(here, "../data/notes.json");
const DATA_FILE = process.env.NOTES_DATA_FILE ?? DEFAULT_DATA_FILE;
const clientDist = resolve(here, "../../client/dist");
const staticDir = existsSync(resolve(clientDist, "index.html"))
  ? clientDist
  : undefined;

const app = createApp(new NotesStore(DATA_FILE), { staticDir });

app.listen(PORT, HOST, () => {
  const origin = `http://${HOST}:${PORT}`;
  if (staticDir) {
    console.log(`Notes app listening on ${origin}`);
  } else {
    console.log(`Notes API listening on ${origin}`);
  }
});
