import { useRef, useState } from "react";
import { uploadFile } from "./api.js";

// Allowed types mirror the server's validation (images, video, PDF).
const ACCEPT = "image/*,video/*,application/pdf";

// Drop-in uploader. Give it `onUploaded` to refresh a list when a file lands.
export default function FileSubmission({ onUploaded }) {
  const inputRef = useRef(null);
  const [queue, setQueue] = useState([]); // [{ name, pct, status, error }]
  const [dragging, setDragging] = useState(false);

  async function handleFiles(fileList) {
    const files = Array.from(fileList);
    for (const file of files) {
      const item = { name: file.name, pct: 0, status: "uploading", error: null };
      setQueue((q) => [item, ...q]);
      const update = (patch) =>
        setQueue((q) => q.map((it) => (it === item ? { ...it, ...patch } : it)));
      try {
        await uploadFile(file, { onProgress: (pct) => update({ pct }) });
        update({ status: "done", pct: 100 });
        onUploaded?.();
      } catch (err) {
        update({ status: "error", error: err.message });
      }
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="uploader">
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <p className="dz-title">Drop files here, or click to choose</p>
        <p className="dz-sub">Images, videos, and PDFs</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="queue">
          {queue.map((it, i) => (
            <li key={i} className={`queue-item ${it.status}`}>
              <span className="qi-name">{it.name}</span>
              {it.status === "uploading" && (
                <span className="qi-bar">
                  <span className="qi-fill" style={{ width: `${it.pct}%` }} />
                </span>
              )}
              <span className="qi-status">
                {it.status === "uploading" && `${it.pct}%`}
                {it.status === "done" && "✓ done"}
                {it.status === "error" && `✗ ${it.error}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
