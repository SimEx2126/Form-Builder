#!/usr/bin/env node
// Backup the formbuilder MongoDB database to a JSON dump.
// Usage: node scripts/backup.mjs [output-dir]
//
// Produces one JSON file per collection in the output directory.
// Restore with: node scripts/restore.mjs [backup-dir]

import "dotenv/config";
import { MongoClient } from "mongodb";
import fs from "node:fs";
import path from "node:path";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGO_DB || "formbuilder";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = process.argv[2] || path.join("backups", timestamp);

async function main() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collections = await db.listCollections().toArray();

    fs.mkdirSync(outDir, { recursive: true });

    for (const { name } of collections) {
      const docs = await db.collection(name).find({}).toArray();
      const file = path.join(outDir, `${name}.json`);
      fs.writeFileSync(file, JSON.stringify(docs, null, 2));
      console.log(`  ${name}: ${docs.length} documents -> ${file}`);
    }

    const manifest = {
      database: DB_NAME,
      timestamp: new Date().toISOString(),
      collections: collections.map((c) => c.name),
    };
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`\nBackup complete: ${outDir}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
