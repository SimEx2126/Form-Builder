#!/usr/bin/env node
// Simple load test for the form-builder API.
// Usage: node scripts/loadtest.mjs [base-url] [concurrency] [total-requests]
//
// Registers a user, creates a form, then hammers the submit endpoint.

const BASE = process.argv[2] || "http://localhost:4000";
const CONCURRENCY = Number(process.argv[3]) || 10;
const TOTAL = Number(process.argv[4]) || 100;

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function setup() {
  const email = `loadtest_${Date.now()}@test.com`;
  const { body } = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password: "loadtest123", name: "Load Tester" }),
  });
  const token = body.token;

  const { body: form } = await api("/api/forms", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: "Load Test Form",
      fields: [
        { type: "short_text", label: "Name", required: true },
        { type: "email", label: "Email", required: false },
      ],
    }),
  });

  return { token, formId: form.id, fieldIds: form.fields.map((f) => f.id) };
}

async function submitOne(formId, fieldIds, index) {
  const start = performance.now();
  const { status } = await api(`/api/forms/${formId}/responses`, {
    method: "POST",
    body: JSON.stringify({
      submissionId: `load-${Date.now()}-${index}`,
      answers: { [fieldIds[0]]: `User ${index}`, [fieldIds[1]]: `user${index}@test.com` },
    }),
  });
  const ms = performance.now() - start;
  return { status, ms };
}

async function run() {
  console.log(`Load test: ${BASE}`);
  console.log(`Concurrency: ${CONCURRENCY}, Total requests: ${TOTAL}\n`);

  const { formId, fieldIds } = await setup();
  console.log(`Created form ${formId}, starting submissions...\n`);

  const results = [];
  let completed = 0;
  const allStart = performance.now();

  const queue = Array.from({ length: TOTAL }, (_, i) => i);

  async function worker() {
    while (queue.length > 0) {
      const i = queue.shift();
      const r = await submitOne(formId, fieldIds, i);
      results.push(r);
      completed++;
      if (completed % 25 === 0) {
        process.stdout.write(`  ${completed}/${TOTAL} done\r`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const totalMs = performance.now() - allStart;

  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const ok = results.filter((r) => r.status === 200).length;
  const rateLimited = results.filter((r) => r.status === 429).length;
  const errors = results.filter((r) => r.status >= 500).length;

  console.log(`\n--- Results ---`);
  console.log(`Total time:   ${(totalMs / 1000).toFixed(2)}s`);
  console.log(`Throughput:   ${(TOTAL / (totalMs / 1000)).toFixed(1)} req/s`);
  console.log(`Success:      ${ok}/${TOTAL}`);
  console.log(`Rate limited: ${rateLimited}`);
  console.log(`Errors (5xx): ${errors}`);
  console.log(`Latency p50:  ${times[Math.floor(times.length * 0.5)].toFixed(0)}ms`);
  console.log(`Latency p95:  ${times[Math.floor(times.length * 0.95)].toFixed(0)}ms`);
  console.log(`Latency p99:  ${times[Math.floor(times.length * 0.99)].toFixed(0)}ms`);
  console.log(`Latency max:  ${times[times.length - 1].toFixed(0)}ms`);
}

run().catch((err) => {
  console.error("Load test failed:", err.message);
  process.exit(1);
});
