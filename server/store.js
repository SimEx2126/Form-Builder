// Tiny JSON-file store. One file per collection.
// Placeholder for the main app's real database — swap these for SQL/ORM calls
// when porting into Morpheus.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function makeStore(filename) {
  const file = path.join(__dirname, filename);
  const load = () =>
    fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  const save = (rows) => fs.writeFileSync(file, JSON.stringify(rows, null, 2));
  return {
    all: () => load(),
    find: (id) => load().find((r) => r.id === id),
    insert(row) {
      const rows = load();
      rows.push(row);
      save(rows);
      return row;
    },
    update(id, patch) {
      const rows = load();
      const row = rows.find((r) => r.id === id);
      if (!row) return null;
      Object.assign(row, patch);
      save(rows);
      return row;
    },
    filter: (fn) => load().filter(fn),
  };
}
