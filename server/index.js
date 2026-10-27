import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";
import { storage } from "./storage.js";
import { makeStore, dbReady, ensureIndexes } from "./store.js";
import { authRoutes, requireAuth } from "./auth.js";

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
const users = makeStore("users"); // auth accounts

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Request logging
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const user = req.user?.email || "-";
    console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms user=${user}`);
  });
  next();
});

// ---------------------------------------------------------------------------
// NoSQL injection prevention — strip keys starting with $ from request bodies
// ---------------------------------------------------------------------------
function sanitize(obj) {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj !== null && typeof obj === "object") {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith("$")) continue;
      clean[k] = sanitize(v);
    }
    return clean;
  }
  return obj;
}

app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitize(req.body);
  }
  next();
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const publicLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const submitLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions, please slow down." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

// ===========================================================================
// AUTH
// ===========================================================================
authRoutes(app, users, authLimiter);

// Apply auth limiter to login/register
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// ===========================================================================
// FILE UPLOADS  (public — needed for file fields in public forms)
// ===========================================================================

app.post("/api/uploads/presign", publicLimiter, async (req, res) => {
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
// FORMS  (the builder side — protected)
// ===========================================================================

const MAX_FIELDS = 50;

function normalizeForm(body, existingFields) {
  const errors = [];
  const title = (body?.title || "").trim();
  if (!title) errors.push("Form title is required");
  if (title.length > 200) errors.push("Form title is too long (max 200 chars)");

  const usedIds = new Set();
  const rawFields = Array.isArray(body?.fields) ? body.fields : [];
  if (rawFields.length > MAX_FIELDS) errors.push(`Too many fields (max ${MAX_FIELDS})`);

  const fields = rawFields.slice(0, MAX_FIELDS).map((f, i) => {
    const type = f?.type;
    if (!FIELD_TYPES.includes(type)) errors.push(`Field ${i + 1}: unknown type "${type}"`);
    const label = (f?.label || "").trim();
    if (!label) errors.push(`Field ${i + 1}: label is required`);
    if (label.length > 200) errors.push(`Field ${i + 1}: label too long (max 200 chars)`);

    let id = f.id;
    if (typeof id !== "string") id = undefined;
    if (!id && existingFields) {
      const match = existingFields.find(
        (ef) => ef.type === type && ef.label === label && !usedIds.has(ef.id)
      );
      if (match) id = match.id;
    }
    if (!id) id = nanoid(8);
    usedIds.add(id);

    const field = { id, type, label, required: !!f.required };
    if (CHOICE_TYPES.includes(type)) {
      const options = (Array.isArray(f.options) ? f.options : [])
        .map((o) => String(o).trim())
        .filter(Boolean)
        .slice(0, 100);
      if (options.length === 0) errors.push(`Field "${label || i + 1}": needs at least one option`);
      field.options = options;
    }
    return field;
  });

  const audience = (body?.audience || "").trim().slice(0, 200) || null;
  const category = (body?.category || "").trim().slice(0, 200) || null;

  return { errors, title, description: (body?.description || "").trim().slice(0, 2000), fields, audience, category };
}

// Protected: create form
app.post("/api/forms", requireAuth, async (req, res) => {
  const { errors, title, description, fields, audience, category } = normalizeForm(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });
  const form = {
    id: nanoid(10),
    title, description, audience, category, fields,
    version: 1,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };
  await forms.insert(form);
  res.json(form);
});

// Protected: update form
app.put("/api/forms/:id", requireAuth, async (req, res) => {
  const existing = await forms.find(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const clientVersion = req.body?.version;
  if (clientVersion != null && clientVersion !== existing.version) {
    return res.status(409).json({
      error: "Conflict: form was modified by another user. Please refresh and try again.",
      currentVersion: existing.version,
    });
  }

  const { errors, title, description, fields, audience, category } = normalizeForm(req.body, existing.fields);
  if (errors.length) return res.status(400).json({ error: errors.join("; ") });

  const nextVersion = (existing.version || 0) + 1;
  const form = await forms.updateIf(req.params.id, existing.version, {
    title, description, audience, category, fields,
    version: nextVersion,
    updatedBy: req.user.id,
    updatedAt: new Date().toISOString(),
  });

  if (!form) {
    return res.status(409).json({
      error: "Conflict: form was modified concurrently. Please refresh and try again.",
    });
  }
  res.json(form);
});

// Protected: list forms (dashboard)
app.get("/api/forms", requireAuth, async (_req, res) => {
  const [counts, allForms] = await Promise.all([
    responses.countByField("formId"),
    forms.all(),
  ]);
  const rows = allForms
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(({ _id, ...f }) => ({ ...f, responseCount: counts[f.id] || 0 }));
  res.json(rows);
});

// Public: get single form (needed to fill it)
app.get("/api/forms/:id", async (req, res) => {
  const form = await forms.find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const { _id, ...f } = form;
  res.json(f);
});

// ===========================================================================
// RESPONSES  (fill side — public submit, protected view)
// ===========================================================================

// Public: submit a response
app.post("/api/forms/:id/responses", submitLimiter, async (req, res) => {
  const form = await forms.find(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found" });

  const submissionId = typeof req.body?.submissionId === "string"
    ? req.body.submissionId.trim().slice(0, 64)
    : null;

  if (submissionId) {
    const existing = await responses.query({ submissionId });
    if (existing.length > 0) {
      return res.json({ ok: true, id: existing[0].id, duplicate: true });
    }
  }

  const answers = req.body?.answers || {};
  const missing = [];
  for (const field of form.fields) {
    if (!field.required) continue;
    const val = answers[field.id];
    const empty =
      val == null ||
      (typeof val === "string" && val.trim() === "") ||
      (Array.isArray(val) && val.length === 0) ||
      (typeof val === "object" && !Array.isArray(val) &&
        Object.values(val).every((v) => !String(v ?? "").trim()));
    if (empty) missing.push(field.label);
  }
  if (missing.length) return res.status(400).json({ error: `Missing required: ${missing.join(", ")}` });

  const response = {
    id: nanoid(10),
    formId: form.id,
    formVersion: form.version || 1,
    ...(submissionId ? { submissionId } : {}),
    answers,
    createdAt: new Date().toISOString(),
  };

  try {
    await responses.insert(response);
  } catch (err) {
    if (err.code === 11000 && submissionId) {
      const existing = await responses.query({ submissionId });
      if (existing.length > 0) {
        return res.json({ ok: true, id: existing[0].id, duplicate: true });
      }
    }
    throw err;
  }

  res.json({ ok: true, id: response.id });
});

// Protected: view responses
app.get("/api/forms/:id/responses", requireAuth, async (req, res) => {
  const form = await forms.find(req.params.id);
  if (!form) return res.status(404).json({ error: "Form not found" });
  const rows = await responses.query({ formId: form.id });
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

dbReady.then(async () => {
  await ensureIndexes({ forms, responses, submissions, users });
  app.listen(PORT, () => {
    console.log(`form-builder server on http://localhost:${PORT} (storage: ${storage.mode}, db: mongodb)`);
  });
}).catch((err) => {
  console.error("Failed to connect to MongoDB:", err.message);
  process.exit(1);
});
