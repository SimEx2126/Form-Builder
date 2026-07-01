// Client for the form-builder API.
//
// File uploads still use the 3-step flow (presign -> PUT bytes -> complete);
// forms and responses are plain JSON CRUD on top.

const BASE = ""; // same-origin; Vite proxies /api to the backend in dev

async function jsonOrThrow(res, fallback) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || fallback);
  }
  return res.json();
}

// ---- forms ----------------------------------------------------------------

export const listForms = () =>
  fetch(`${BASE}/api/forms`).then((r) => jsonOrThrow(r, "Failed to load forms"));

export const getForm = (id) =>
  fetch(`${BASE}/api/forms/${id}`).then((r) => jsonOrThrow(r, "Form not found"));

export const createForm = (form) =>
  fetch(`${BASE}/api/forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  }).then((r) => jsonOrThrow(r, "Failed to save form"));

export const updateForm = (id, form) =>
  fetch(`${BASE}/api/forms/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  }).then((r) => jsonOrThrow(r, "Failed to update form"));

// ---- responses ------------------------------------------------------------

export const submitResponse = (formId, answers) =>
  fetch(`${BASE}/api/forms/${formId}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  }).then((r) => jsonOrThrow(r, "Failed to submit"));

export const listResponses = (formId) =>
  fetch(`${BASE}/api/forms/${formId}/responses`).then((r) =>
    jsonOrThrow(r, "Failed to load responses")
  );

// ---- file uploads ---------------------------------------------------------

export async function getDownloadUrl(id) {
  const res = await fetch(`${BASE}/api/uploads/${id}/download`);
  return jsonOrThrow(res, "Failed to get download link"); // { url, filename, contentType }
}

// Uploads one file. `onProgress(pct)` is called 0..100 during transfer.
// Resolves to { id } once the upload is complete.
export async function uploadFile(file, { onProgress } = {}) {
  const presign = await fetch(`${BASE}/api/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  }).then((r) => jsonOrThrow(r, "Could not start upload"));

  await putWithProgress(presign.uploadUrl, file, presign.headers, onProgress);

  await fetch(`${BASE}/api/uploads/${presign.id}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size: file.size }),
  });

  return { id: presign.id };
}

function putWithProgress(url, file, headers = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
