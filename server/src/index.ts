import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { NotesStore } from "./notesStore.js";

const PORT = readPort(process.env.PORT);
const HOST = process.env.HOST || "0.0.0.0";
const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_FILE = resolve(here, "../data/notes.json");
const DATA_FILE = process.env.NOTES_DATA_FILE ?? DEFAULT_DATA_FILE;
const clientDist = resolve(here, "../../client/dist");
const staticDir = existsSync(resolve(clientDist, "index.html"))
  ? clientDist
  : undefined;

const app = createApp(new NotesStore(DATA_FILE), { staticDir });

const server = app.listen(PORT, HOST, () => {
  const origin = `http://${HOST}:${PORT}`;
  if (staticDir) {
    console.log(`Notes app listening on ${origin}`);
  } else {
    console.log(`Notes API listening on ${origin}`);
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  console.error(`Notes server failed to listen on ${HOST}:${PORT}:`, err.message);
  process.exit(1);
});

function readPort(raw: string | undefined): number {
  const port = Number(raw ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${raw ?? ""}`);
  }
  return port;
}
