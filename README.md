# Form Builder (with optional file uploads)

A lightweight form builder, built to drop into a larger app. A creator builds a
form by adding fields; one of the field types is **file upload** (images, video,
PDF) — so a form can collect typed answers, files, or both. Respondents open a
shareable link, fill it in, and a few reviewers read the responses.

- **`web/`** — React (Vite) frontend: Home, Builder, Fill, and Responses pages.
- **`server/`** — Express backend: forms, responses, and file-upload endpoints.

File uploads run **with no AWS out of the box** (saved to local disk), then
switch to **AWS S3** by changing env vars.

---

## Run it locally (no AWS needed)

Open two terminals.

**1. Backend**
```bash
cd server
npm install
cp .env.example .env      # defaults to STORAGE=local
npm run dev               # http://localhost:4000
```

**2. Frontend**
```bash
cd web
npm install
npm run dev               # http://localhost:5173
```

Open http://localhost:5173, click **New form**, add fields (including a
**File upload** field if you want), save, then open the form and submit a
response. View what came in on the **Responses** page.

---

## How it works

**Field types:** short text, long text, email, dropdown, multiple choice, file upload.

**Data model (JSON-file store — swap for the app's real DB when porting):**
- `forms.json` — form definitions: `{ id, title, description, fields[] }`
- `responses.json` — submitted answers keyed by field id
- `submissions.json` — uploaded-file metadata (S3 key, type, size)

**File upload flow (unchanged):** browser asks the backend for a presigned URL,
PUTs the bytes straight to storage (S3 or the local server), then the response
records a reference to the uploaded file. Large videos never pass through the
app server in S3 mode.

**API**
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/forms` | create a form |
| PUT  | `/api/forms/:id` | update a form |
| GET  | `/api/forms` | list forms (+ response counts) |
| GET  | `/api/forms/:id` | get one form (for filling) |
| POST | `/api/forms/:id/responses` | submit a response |
| GET  | `/api/forms/:id/responses` | list responses |
| POST | `/api/uploads/presign` | start a file upload |
| POST | `/api/uploads/:id/complete` | finish a file upload |
| GET  | `/api/uploads/:id/download` | short-lived view/download link |

---

## Switch to AWS S3

1. Create a **private** S3 bucket (block all public access).
2. In `server/.env`:
   ```
   STORAGE=s3
   AWS_REGION=ap-southeast-2
   S3_BUCKET=your-private-bucket-name
   ```
3. Credentials: an **IAM role** in production (needs `s3:PutObject` + `s3:GetObject`),
   or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` for local testing.
4. Add a bucket **CORS rule** so the browser can PUT directly:
   ```json
   [{ "AllowedMethods": ["PUT","GET"], "AllowedOrigins": ["http://localhost:5173"], "AllowedHeaders": ["*"] }]
   ```
   (Add the production domain to `AllowedOrigins` when you deploy.)

No frontend changes needed — the browser uses whatever URL the backend hands it.

---

## Porting into the main app (Morpheus)

- **Frontend:** copy `web/src/pages/*`, `web/src/components/FileSubmission.jsx`,
  and `web/src/api.js`. Mount the routes where you need them.
- **Backend:** copy the routes from `server/index.js` plus `storage.js` / `store.js`.
- **Database:** replace the JSON-file store (`store.js`) with the app's real DB.

## Intentional next steps (not built yet)

- **Auth** — restrict who can build forms and view responses; tag responses with the submitter.
- **More field types** — number, date, phone, etc.
- **Export** — download responses as CSV.
- **Virus scanning** + **resumable uploads** + **S3 lifecycle archiving** for files.
