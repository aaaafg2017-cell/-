import { createApp } from "./app.js";
import { NotesStore } from "./notesStore.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const DATA_FILE = process.env.NOTES_DATA_FILE ?? "data/notes.json";

const app = createApp(new NotesStore(DATA_FILE));

app.listen(PORT, HOST, () => {
  console.log(`Notes API listening on http://${HOST}:${PORT}`);
});
