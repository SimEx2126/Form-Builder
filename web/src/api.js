// Client for the file-submission API.
//
// The upload is a 3-step flow:
//   1. ask the backend for a presigned upload URL
//   2. PUT the file bytes straight to that URL (S3 or local server)
//   3. tell the backend the upload finished
//
// This is the logic you'd lift into the main app. Keep it framework-agnostic
// so it works anywhere, not just React.

const BASE = ""; // same-origin; Vite proxies /api to the backend in dev

export async function listSubmissions() {
  const res = await fetch(`${BASE}/api/uploads`);
  if (!res.ok) throw new Error("Failed to load submissions");
  return res.json();
}

export async function getDownloadUrl(id) {
  const res = await fetch(`${BASE}/api/uploads/${id}/download`);
  if (!res.ok) throw new Error("Failed to get download link");
  return res.json(); // { url, filename, contentType }
}

// Uploads one file. `onProgress(pct)` is called 0..100 during transfer.
export async function uploadFile(file, { onProgress } = {}) {
  // 1) presign
  const presignRes = await fetch(`${BASE}/api/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  });
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.error || "Could not start upload");
  }
  const { id, uploadUrl, headers } = await presignRes.json();

  // 2) PUT the bytes (XHR so we get progress events)
  await putWithProgress(uploadUrl, file, headers, onProgress);

  // 3) mark complete
  await fetch(`${BASE}/api/uploads/${id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size: file.size }),
  });

  return { id };
}

function putWithProgress(url, file, headers = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
