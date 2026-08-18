import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { NotesStore } from "./notesStore.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const DEFAULT_DATA_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../data/notes.json",
);
const DATA_FILE = process.env.NOTES_DATA_FILE ?? DEFAULT_DATA_FILE;

const app = createApp(new NotesStore(DATA_FILE));

app.listen(PORT, HOST, () => {
  console.log(`Notes API listening on http://${HOST}:${PORT}`);
});
