# File Submission Feature

A minimal, self-contained file-submission feature: users upload **images, videos, and PDFs**; a few reviewers list and view them. Built to drop into a larger app.

- **`web/`** — React (Vite) frontend. The `<FileSubmission />` component is the piece to port into the main app.
- **`server/`** — Express backend. Issues presigned upload URLs and stores submission metadata.

It runs **out of the box with no AWS** (files save to local disk), then switches to **AWS S3** by changing env vars.

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

Open http://localhost:5173 and upload a file. In local mode, files are written to `server/uploads/` and metadata to `server/submissions.json`.

---

## Switch to AWS S3

1. Create a **private** S3 bucket (block all public access).
2. In `server/.env`:
   ```
   STORAGE=s3
   AWS_REGION=ap-southeast-2
   S3_BUCKET=your-private-bucket-name
   ```
3. Provide credentials — an **IAM role** in production, or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` for local testing. The IAM identity needs `s3:PutObject` and `s3:GetObject` on the bucket.
4. Add a **CORS rule** to the bucket so the browser can PUT directly:
   ```json
   [
     {
       "AllowedMethods": ["PUT", "GET"],
       "AllowedOrigins": ["http://localhost:5173"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": []
     }
   ]
   ```
   (Add your production domain to `AllowedOrigins` when you deploy.)

No frontend changes are needed — the browser uses whatever URL the backend hands it.

---

## How the upload works

1. Browser asks the backend for an upload URL (`POST /api/uploads/presign`). The backend validates type/size and records a `pending` submission.
2. Browser PUTs the file **directly** to that URL — to S3 in S3 mode, or to the backend's `/local` route in local mode. Large videos never pass through the app server in S3 mode.
3. Browser confirms (`POST /api/uploads/:id/complete`); the submission is marked `complete`.
4. Reviewers list (`GET /api/uploads`) and open files via short-lived links (`GET /api/uploads/:id/download`).

---

## Porting into the main app

- **Frontend:** copy `web/src/FileSubmission.jsx` and `web/src/api.js`. Render `<FileSubmission onUploaded={...} />` wherever you need it.
- **Backend:** copy the four routes from `server/index.js` and `server/storage.js` into your existing server.
- **Metadata:** the JSON file store (`submissions.json`) is a placeholder — swap `loadDb`/`saveDb` for your real database.

## Not yet included (intentional next steps)

- **Auth** — wire `uploadedBy` and the view/download routes to the app's login once it exists.
- **Virus scanning** — scan uploads asynchronously before marking them viewable.
- **Resumable/multipart uploads** — for very large or flaky-connection video uploads (S3 multipart).
- **Lifecycle rules** — auto-archive old files to cheaper S3 storage.
