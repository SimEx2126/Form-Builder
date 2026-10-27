// Simple in-process post-submit job queue.
// Jobs are enqueued after a response is saved and processed asynchronously.
// Each handler receives { formId, responseId, answers, formTitle }.
// Failures are logged but never block the submission response.

const handlers = [];
const pending = [];
let processing = false;

export function onSubmit(fn) {
  handlers.push(fn);
}

export function enqueue(job) {
  pending.push(job);
  if (!processing) drain();
}

async function drain() {
  processing = true;
  while (pending.length > 0) {
    const job = pending.shift();
    for (const handler of handlers) {
      try {
        await handler(job);
      } catch (err) {
        console.error(`[queue] handler failed for response ${job.responseId}:`, err.message);
      }
    }
  }
  processing = false;
}
