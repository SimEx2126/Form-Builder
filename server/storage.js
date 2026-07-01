// Storage adapter.
//
// Exposes one interface with two implementations:
//   - local: streams files to ./uploads on disk (no AWS needed)
//   - s3:    issues presigned PUT/GET URLs so the browser talks to S3 directly
//
// Both return an `uploadUrl` the browser PUTs the file to, and a short-lived
// `downloadUrl` for viewing. The frontend code is identical for both modes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODE = (process.env.STORAGE || "local").toLowerCase();
const PUBLIC_BASE = process.env.PUBLIC_BASE || "http://localhost:4000";

// ---- local-disk implementation -------------------------------------------

const UPLOAD_DIR = path.join(__dirname, "uploads");

function localStorage() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  return {
    mode: "local",
    // The browser will PUT the bytes to our own server, which streams to disk.
    async createUploadUrl({ key, contentType }) {
      // Relative URL so it resolves to whatever host the page is on
      // (localhost on desktop, the Mac's IP on a phone) via the dev proxy.
      return {
        uploadUrl: `/local/${encodeURIComponent(key)}`,
        method: "PUT",
        headers: contentType ? { "Content-Type": contentType } : {},
      };
    },
    async createDownloadUrl({ key }) {
      return `/local/${encodeURIComponent(key)}`;
    },
    pathForKey(key) {
      // keys look like "2026/06/<id>-<filename>"; keep the structure on disk
      const safe = key.split("/").map((p) => p.replace(/[^a-zA-Z0-9._-]/g, "_"));
      return path.join(UPLOAD_DIR, ...safe);
    },
  };
}

// ---- S3 implementation ----------------------------------------------------

function s3Storage() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket) throw new Error("S3_BUCKET is required when STORAGE=s3");
  const client = new S3Client({ region });

  return {
    mode: "s3",
    async createUploadUrl({ key, contentType }) {
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });
      const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 900 }); // 15 min
      return {
        uploadUrl,
        method: "PUT",
        headers: contentType ? { "Content-Type": contentType } : {},
      };
    },
    async createDownloadUrl({ key }) {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(client, cmd, { expiresIn: 900 }); // 15 min
    },
  };
}

export const storage = MODE === "s3" ? s3Storage() : localStorage();
