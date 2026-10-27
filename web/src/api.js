// Client for the form-builder API.

const BASE = ""; // same-origin; Vite proxies /api to the backend in dev

function getToken() {
  try { return localStorage.getItem("fb_token"); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem("fb_token", token);
    else localStorage.removeItem("fb_token");
  } catch {}
}

export function isLoggedIn() {
  return !!getToken();
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function jsonOrThrow(res, fallback) {
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event("fb:logout"));
    throw new Error("Session expired — please log in again.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || fallback);
  }
  return res.json();
}

// ---- auth ------------------------------------------------------------------

export const login = (email, password) =>
  fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then((r) => jsonOrThrow(r, "Login failed"));

export const register = (email, password, name) =>
  fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  }).then((r) => jsonOrThrow(r, "Registration failed"));

export const getMe = () =>
  fetch(`${BASE}/api/auth/me`, {
    headers: authHeaders(),
  }).then((r) => jsonOrThrow(r, "Not authenticated"));

// ---- forms (protected) -----------------------------------------------------

export const listForms = () =>
  fetch(`${BASE}/api/forms`, {
    headers: authHeaders(),
  }).then((r) => jsonOrThrow(r, "Failed to load forms"));

export const getForm = (id) =>
  fetch(`${BASE}/api/forms/${id}`).then((r) => jsonOrThrow(r, "Form not found"));

export const createForm = (form) =>
  fetch(`${BASE}/api/forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(form),
  }).then((r) => jsonOrThrow(r, "Failed to save form"));

export const updateForm = async (id, form) => {
  const res = await fetch(`${BASE}/api/forms/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(form),
  });
  if (res.status === 409) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "This form was modified by someone else. Please refresh and try again.");
  }
  return jsonOrThrow(res, "Failed to update form");
};

// ---- responses --------------------------------------------------------------

export const submitResponse = (formId, answers) => {
  const submissionId = globalThis.crypto?.randomUUID?.() || `sub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return fetch(`${BASE}/api/forms/${formId}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ submissionId, answers }),
  }).then((r) => jsonOrThrow(r, "Failed to submit"));
};

export const listResponses = (formId) =>
  fetch(`${BASE}/api/forms/${formId}/responses`, {
    headers: authHeaders(),
  }).then((r) => jsonOrThrow(r, "Failed to load responses"));

// ---- file uploads -----------------------------------------------------------

export async function getDownloadUrl(id) {
  const res = await fetch(`${BASE}/api/uploads/${id}/download`);
  return jsonOrThrow(res, "Failed to get download link");
}

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
