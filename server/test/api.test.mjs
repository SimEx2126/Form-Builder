// API test suite for form-builder server.
// Run: node --test server/test/api.test.mjs
// Requires the server to be running on PORT (default 4000).

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.TEST_BASE || "http://localhost:4000";
let token;
let formId;
let fieldIds;
const testEmail = `test_${Date.now()}@example.com`;
const testPass = "testpass123";

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ── Health ─────────────────────────────────────────────────────────────

describe("Health", () => {
  it("returns ok status", async () => {
    const { status, body } = await api("/api/health");
    assert.equal(status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.db, "connected");
    assert.equal(typeof body.uptime, "number");
  });
});

// ── Auth ────────────────────────────────────────────────────────────────

describe("Auth", () => {
  it("rejects register without email", async () => {
    const { status } = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ password: "123456" }),
    });
    assert.equal(status, 400);
  });

  it("rejects register with short password", async () => {
    const { status } = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: "abc" }),
    });
    assert.equal(status, 400);
  });

  it("registers a new user", async () => {
    const { status, body } = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: testPass, name: "Tester" }),
    });
    assert.equal(status, 200);
    assert.ok(body.token);
    assert.equal(body.user.email, testEmail);
    token = body.token;
  });

  it("rejects duplicate registration", async () => {
    const { status } = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: testPass }),
    });
    assert.equal(status, 409);
  });

  it("logs in with correct credentials", async () => {
    const { status, body } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: testPass }),
    });
    assert.equal(status, 200);
    assert.ok(body.token);
    token = body.token;
  });

  it("rejects wrong password", async () => {
    const { status } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: testEmail, password: "wrongpassword" }),
    });
    assert.equal(status, 401);
  });

  it("returns user info from /me", async () => {
    const { status, body } = await api("/api/auth/me");
    assert.equal(status, 200);
    assert.equal(body.email, testEmail);
  });
});

// ── Protected endpoints without auth ────────────────────────────────────

describe("Auth required", () => {
  it("rejects form creation without token", async () => {
    const saved = token;
    token = null;
    const { status } = await api("/api/forms", {
      method: "POST",
      body: JSON.stringify({ title: "No Auth", fields: [{ type: "short_text", label: "X", required: false }] }),
    });
    token = saved;
    assert.equal(status, 401);
  });

  it("rejects form listing without token", async () => {
    const saved = token;
    token = null;
    const { status } = await api("/api/forms");
    token = saved;
    assert.equal(status, 401);
  });

  it("rejects response viewing without token", async () => {
    const saved = token;
    token = null;
    const { status } = await api("/api/forms/fake-id/responses");
    token = saved;
    assert.equal(status, 401);
  });
});

// ── Forms CRUD ──────────────────────────────────────────────────────────

describe("Forms", () => {
  it("creates a form", async () => {
    const { status, body } = await api("/api/forms", {
      method: "POST",
      body: JSON.stringify({
        title: "API Test Form",
        description: "Test description",
        fields: [
          { type: "short_text", label: "Name", required: true },
          { type: "email", label: "Email", required: true },
          { type: "dropdown", label: "Role", required: false, options: ["Dev", "QA"] },
        ],
      }),
    });
    assert.equal(status, 200);
    assert.ok(body.id);
    assert.equal(body.version, 1);
    assert.equal(body.fields.length, 3);
    formId = body.id;
    fieldIds = body.fields.map((f) => f.id);
  });

  it("rejects form with missing title", async () => {
    const { status } = await api("/api/forms", {
      method: "POST",
      body: JSON.stringify({ fields: [{ type: "short_text", label: "X", required: false }] }),
    });
    assert.equal(status, 400);
  });

  it("rejects form with too-long title", async () => {
    const { status } = await api("/api/forms", {
      method: "POST",
      body: JSON.stringify({ title: "A".repeat(250), fields: [{ type: "short_text", label: "X", required: false }] }),
    });
    assert.equal(status, 400);
  });

  it("gets a form publicly (no auth)", async () => {
    const saved = token;
    token = null;
    const { status, body } = await api(`/api/forms/${formId}`);
    token = saved;
    assert.equal(status, 200);
    assert.equal(body.title, "API Test Form");
    assert.ok(!body._id);
  });

  it("updates a form with correct version", async () => {
    const { status, body } = await api(`/api/forms/${formId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: "API Test Form Updated",
        version: 1,
        fields: [
          { type: "short_text", label: "Name", required: true },
          { type: "email", label: "Email", required: true },
          { type: "dropdown", label: "Role", required: false, options: ["Dev", "QA", "PM"] },
        ],
      }),
    });
    assert.equal(status, 200);
    assert.equal(body.version, 2);
    assert.equal(body.title, "API Test Form Updated");
  });

  it("rejects update with stale version (409)", async () => {
    const { status } = await api(`/api/forms/${formId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: "Should Fail",
        version: 1,
        fields: [{ type: "short_text", label: "Name", required: true }],
      }),
    });
    assert.equal(status, 409);
  });

  it("lists forms with response counts", async () => {
    const { status, body } = await api("/api/forms");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body));
    const found = body.find((f) => f.id === formId);
    assert.ok(found);
    assert.equal(typeof found.responseCount, "number");
    assert.ok(!found._id);
  });
});

// ── Responses ───────────────────────────────────────────────────────────

describe("Responses", () => {
  const subId = `test-sub-${Date.now()}`;

  it("submits a response (public, no auth needed)", async () => {
    const saved = token;
    token = null;
    const { status, body } = await api(`/api/forms/${formId}/responses`, {
      method: "POST",
      body: JSON.stringify({
        submissionId: subId,
        answers: { [fieldIds[0]]: "Jane", [fieldIds[1]]: "jane@test.com" },
      }),
    });
    token = saved;
    assert.equal(status, 200);
    assert.ok(body.ok);
    assert.ok(body.id);
  });

  it("handles duplicate submission idempotently", async () => {
    const saved = token;
    token = null;
    const { status, body } = await api(`/api/forms/${formId}/responses`, {
      method: "POST",
      body: JSON.stringify({
        submissionId: subId,
        answers: { [fieldIds[0]]: "Jane", [fieldIds[1]]: "jane@test.com" },
      }),
    });
    token = saved;
    assert.equal(status, 200);
    assert.equal(body.duplicate, true);
  });

  it("rejects submission with missing required fields", async () => {
    const saved = token;
    token = null;
    const { status, body } = await api(`/api/forms/${formId}/responses`, {
      method: "POST",
      body: JSON.stringify({
        submissionId: `test-missing-${Date.now()}`,
        answers: {},
      }),
    });
    token = saved;
    assert.equal(status, 400);
    assert.ok(body.error.includes("Missing required"));
  });

  it("views responses (requires auth)", async () => {
    const { status, body } = await api(`/api/forms/${formId}/responses`);
    assert.equal(status, 200);
    assert.ok(body.form);
    assert.ok(Array.isArray(body.responses));
    assert.ok(body.responses.length >= 1);
    assert.ok(body.responses[0].formVersion);
    assert.ok(!body.form._id);
    assert.ok(!body.responses[0]._id);
  });
});

// ── NoSQL injection ─────────────────────────────────────────────────────

describe("Injection prevention", () => {
  it("strips $-prefixed keys from request bodies", async () => {
    const { status, body } = await api("/api/forms", {
      method: "POST",
      body: JSON.stringify({
        title: "Inject Test",
        fields: [{ type: "short_text", label: "X", required: false }],
        $where: "1==1",
        $gt: "",
      }),
    });
    assert.equal(status, 200);
    assert.ok(body.id);
    assert.equal(body.$where, undefined);
    assert.equal(body.$gt, undefined);
  });
});

// ── Validation limits ───────────────────────────────────────────────────

describe("Validation limits", () => {
  it("rejects more than 50 fields", async () => {
    const fields = Array.from({ length: 55 }, (_, i) => ({
      type: "short_text", label: `F${i}`, required: false,
    }));
    const { status, body } = await api("/api/forms", {
      method: "POST",
      body: JSON.stringify({ title: "Too Many Fields", fields }),
    });
    assert.equal(status, 400);
    assert.ok(body.error.includes("Too many fields"));
  });
});
