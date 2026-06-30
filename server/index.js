import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { storage } from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 2 * 1024 * 1024 * 1024);

// Allowed file types: images, video, and PDF.
const ALLOWED = [
  (t) => t.startsWith("image/"),
  (t) => t.startsWith("video/"),
  (t) => t === "application/pdf",
];
const isAllowed = (type) => !!type && ALLOWED.some((fn) => fn(type));

// --- tiny JSON metadata store ----------------------------------------------
// Swap this for the main app's real database (Postgres, etc.) in production.
const DB_FILE = path.join(__dirname, "submissions.json");
const loadDb = () =>
  fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf8")) : [];
const saveDb = (rows) => fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2));

const app = express();
app.use(cors());
app.use(express.json());

// 1) Ask for an upload URL. We validate, record a "pending" submission,
//    and hand back a URL the browser PUTs the file to directly.
app.post("/api/uploads/presign", async (req, res) => {
  try {
    const { filename, contentType, size } = req.body || {};
    if (!filename || !contentType) {
      return res.status(400).json({ error: "filename and contentType are required" });
    }
    if (!isAllowed(contentType)) {
      return res.status(415).json({ error: `File type not allowed: ${contentType}` });
    }
    if (typeof size === "number" && size > MAX_BYTES) {
      return res.status(413).json({
        error: `File too large. Max is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.`,
      });
    }

    const id = nanoid();
    const now = new Date();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    // Partition keys by year/month so the bucket stays tidy.
    const key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${id}-${safeName}`;

    const upload = await storage.createUploadUrl({ key, contentType });

    const rows = loadDb();
    rows.push({
      id,
      key,
      filename,
      contentType,
      size: size ?? null,
      status: "pending",
      // Wire this to the logged-in user once auth exists.
      uploadedBy: req.body.uploadedBy ?? null,
      createdAt: now.toISOString(),
    });
    saveDb(rows);

    res.json({ id, ...upload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create upload" });
  }
});

// 2) Browser calls this after the PUT succeeds, so we know it's really there.
app.post("/api/uploads/:id/complete", (req, res) => {
  const rows = loadDb();
  const row = rows.find((r) => r.id === req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  row.status = "complete";
  row.completedAt = new Date().toISOString();
  if (typeof req.body?.size === "number") row.size = req.body.size;
  saveDb(rows);
  res.json({ ok: true });
});

// 3) List completed submissions (newest first) — for the "few people" who review.
app.get("/api/uploads", (_req, res) => {
  const rows = loadDb()
    .filter((r) => r.status === "complete")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  res.json(rows);
});

// 4) Get a short-lived link to view/download one file.
app.get("/api/uploads/:id/download", async (req, res) => {
  const row = loadDb().find((r) => r.id === req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  const url = await storage.createDownloadUrl({ key: row.key });
  res.json({ url, filename: row.filename, contentType: row.contentType });
});

// --- LOCAL MODE ONLY: receive and serve the bytes ourselves ---------------
// In S3 mode these routes are unused — the browser talks to S3 directly.
if (storage.mode === "local") {
  // Receive a PUT and stream it to disk (handles large videos without
  // buffering the whole file in memory).
  app.put("/local/:key", (req, res) => {
    const key = decodeURIComponent(req.params.key);
    const dest = storage.pathForKey(key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const out = fs.createWriteStream(dest);
    req.pipe(out);
    out.on("finish", () => res.json({ ok: true }));
    out.on("error", (err) => {
      console.error(err);
      res.status(500).json({ error: "write failed" });
    });
  });

  // Serve a file back for viewing/download.
  app.get("/local/:key", (req, res) => {
    const key = decodeURIComponent(req.params.key);
    const file = storage.pathForKey(key);
    if (!fs.existsSync(file)) return res.status(404).end();
    res.sendFile(file);
  });
}

app.listen(PORT, () => {
  console.log(`file-submission server on http://localhost:${PORT} (storage: ${storage.mode})`);
});
