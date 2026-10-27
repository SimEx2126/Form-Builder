import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { nanoid } from "nanoid";
import { storage } from "./storage.js";
import { makeStore, dbReady } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 2 * 1024 * 1024 * 1024);

// Allowed upload types: images, video, and PDF.
const ALLOWED = [
  (t) => t.startsWith("image/"),
  (t) => t.startsWith("video/"),
  (t) => t === "application/pdf",
];
const isAllowedUpload = (type) => !!type && ALLOWED.some((fn) => fn(type));

// Field types a form may contain.
const FIELD_TYPES = ["short_text", "long_text", "email", "name", "full_name", "dropdown", "multiple_choice", "file"];
const CHOICE_TYPES = ["dropdown", "multiple_choice"];

const submissions = makeStore("submissions"); // uploaded files
const forms = makeStore("forms"); // form definitions
const responses = makeStore("responses"); // filled-in answers

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ===========================================================================
// FILE UPLOADS  (used by "file" fields; unchanged from the standalone tool)
// ===========================================================================

app.post("/api/uploads/presign", async (req, res) => {
  try {
    const { filename, contentType, size } = req.body || {};
    if (!filename || !contentType)
      return res.status(400).json({ error: "filename and contentType are required" });
    if (!isAllowedUpload(contentType))
      return res.status(415).json({ error: `File type not allowed: ${contentType}` });
    if (typeof size === "number" && size > MAX_BYTES)
      return res.status(413).json({ error: `File too large. Max is ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` });

    const id = nanoid();
    const now = new Date();
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${id}-${safeName}`;
    const upload = await storage.createUploadUrl({ key, contentType });

    await submissions.insert({
      id, key, filename, contentType, size: size ?? null,
      status: "pending", createdAt: now.toISOString(),
    });
    res.json({ id, ...upload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create upload" });
  }
});

app.post("/api/uploads/:id/complete", async (req, res) => {
  const row = await submissions.update(req.params.id, {
    status: "complete",
    completedAt: new Date().toISOString(),
    ...(typeof req.body?.size === "number" ? { size: req.body.size } : {}),
  });
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

app.get("/api/uploads/:id/download", async (req, res) => {
  const row = await submissions.find(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  const url = await storage.createDownloadUrl({ key: row.key });
  res.json({ url, filename: row.filename, contentType: row.contentType });
});

// ===========================================================================
// FORMS  (the builder side)
// ===========================================================================

// Validate + normalize a form definition coming from the builder.
// When existingFields is provided (updates), match by type+label to preserve IDs.
function normalizeForm(body, existingFields) {
  const errors = [];
  const title = (body?.title || "").trim();
  if (!title) errors.push("Form title is required");

  const usedIds = new Set();
  const rawFields = Array.isArray(body?.fields) ? body.fields : [];
  const fields = rawFields.map((f, i) => {
    const type = f?.type;
    if (!FIELD_TYPES.includes(type)) errors.push(`Field ${i + 1}: unknown type "${type}"`);
    const label = (f?.label || "").trim();
    if (!label) errors.push(`Field ${i + 1}: label is required`);

    let id = f.id;
    if (!id && existingFields) {
      const match = existingFields.find(
        (ef) => ef.type === type && ef.label === label && !usedIds.has(ef.id)
      );
      if (match) id = match.id;
    }
    if (!id) id = nanoid(8);
    usedIds.add(id);

    const field = {
      id,
      type,
      label,
      required: !!f.required,
    };
    if (CHOICE_TYPES.includes(type)) {
      const options = (Array.isArray(f.options) ? f.options : [])
        .map((o) => String(o).trim())
        .filter(Boolean);
      if (options.length === 0) errors.push(`Field "${label || i + 1}": needs at least one option`);
      field.options = options;
    }
    return field;
  });

  // Optional metadata: who the form is for and which template it came from.
  const audience = (body?.audience || "").trim() || null;
  const category = (body?.category || "").trim() || null;

  return { errors, title, description: (body?.description || "").trim(), fields, audience, category };
}

app.post("/api/forms", async (req, res) => {
  const { errors, title, description, fields, audience, category } = normalizeForm(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });
  const form = {
    id: nanoid(10),
    title, description, audience, category, fields,
    createdAt: new Date().toISOString(),
  };
  await forms.insert(form);
  res.json(form);
});

app.put("/api/forms/:id", async (req, res) => {
  const existing = await forms.find(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const { errors, title, description, fields, audience, category } = normalizeForm(req.body, existing.fields);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });
  const form = await forms.update(req.params.id, {
    title, description, audience, category, fields,
    updatedAt: new Date().toISOString(),
  });
  res.json(form);
});

// List forms (newest first), with a response count for the dashboard.
app.get("/api/forms", async (_req, res) => {
  const [counts, allForms] = await Promise.all([
    responses.countByField("formId"),
    forms.all(),
  ]);
  const rows = allForms
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(({ _id, ...f }) => ({ ...f, responseCount: counts[f.id] || 0 }));
  res.json(rows);
});

app.get("/api/forms/:id", async (req, res) => {
  const form = await forms.find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const { _id, ...f } = form;
  res.json(f);
});

// ===========================================================================
// RESPONSES  (the fill side)
// ===========================================================================

app.post("/api/forms/:id/responses", async (req, res) => {
  const form = await forms.find(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found" });

  const answers = req.body?.answers || {};
  // Validate required fields.
  const missing = [];
  for (const field of form.fields) {
    if (!field.required) continue;
    const val = answers[field.id];
    const empty =
      val == null ||
      (typeof val === "string" && val.trim() === "") ||
      (Array.isArray(val) && val.length === 0) ||
      // composite fields like "name" -> { first, last }
      (typeof val === "object" && !Array.isArray(val) &&
        Object.values(val).every((v) => !String(v ?? "").trim()));
    if (empty) missing.push(field.label);
  }
  if (missing.length) return res.status(400).json({ error: `Missing required: ${missing.join(", ")}` });

  const response = {
    id: nanoid(10),
    formId: form.id,
    answers,
    createdAt: new Date().toISOString(),
  };
  await responses.insert(response);
  res.json({ ok: true, id: response.id });
});

app.get("/api/forms/:id/responses", async (req, res) => {
  const form = await forms.find(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found" });
  const rows = await responses.filter((r) => r.formId === form.id);
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const { _id: _fid, ...cleanForm } = form;
  const cleanRows = rows.map(({ _id, ...r }) => r);
  res.json({ form: cleanForm, responses: cleanRows });
});

// ===========================================================================
// LOCAL STORAGE MODE: receive + serve file bytes ourselves (no AWS)
// ===========================================================================
if (storage.mode === "local") {
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
  app.get("/local/:key", (req, res) => {
    const file = storage.pathForKey(decodeURIComponent(req.params.key));
    if (!fs.existsSync(file)) return res.status(404).end();
    res.sendFile(file);
  });
}

dbReady.then(() => {
  app.listen(PORT, () => {
    console.log(`form-builder server on http://localhost:${PORT} (storage: ${storage.mode}, db: mongodb)`);
  });
}).catch((err) => {
  console.error("Failed to connect to MongoDB:", err.message);
  process.exit(1);
});
