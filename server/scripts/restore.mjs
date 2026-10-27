#!/usr/bin/env node
// Restore a formbuilder database from a JSON backup.
// Usage: node scripts/restore.mjs <backup-dir>
//
// WARNING: This drops existing collections before restoring.

import "dotenv/config";
import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "formbuilder";

const backupDir = process.argv[2];
if (!backupDir) {
  console.error("Usage: node scripts/restore.mjs <backup-dir>");
  process.exit(1);
}

async function main() {
  const manifestPath = path.join(backupDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No manifest.json found in ${backupDir}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  console.log(`Restoring from backup: ${manifest.timestamp} (db: ${manifest.database})`);

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    for (const name of manifest.collections) {
      const file = path.join(backupDir, `${name}.json`);
      if (!fs.existsSync(file)) {
        console.warn(`  SKIP ${name}: file not found`);
        continue;
      }
      const docs = JSON.parse(fs.readFileSync(file, "utf-8"));
      await db.collection(name).drop().catch(() => {});
      if (docs.length > 0) {
        await db.collection(name).insertMany(docs);
      }
      console.log(`  ${name}: ${docs.length} documents restored`);
    }

    console.log("\nRestore complete. Run the server to rebuild indexes.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Restore failed:", err.message);
  process.exit(1);
});
