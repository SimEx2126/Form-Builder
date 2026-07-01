import { useRef, useState } from "react";
import { uploadFile } from "../api.js";

// Allowed types mirror the server's validation (images, video, PDF).
const ACCEPT = "image/*,video/*,application/pdf";

// Drop-in uploader.
//   onComplete(meta) -> called once per successfully uploaded file, with
//                       { id, name, contentType, size }. Use this to collect
//                       uploaded files for a form answer.
export default function FileSubmission({ onComplete }) {
  const inputRef = useRef(null);
  const [queue, setQueue] = useState([]); // [{ name, pct, status, error }]
  const [dragging, setDragging] = useState(false);

  async function handleFiles(fileList) {
    for (const file of Array.from(fileList)) {
      // Track by a stable id — matching by object reference breaks once the
      // item is replaced by a state update (which left rows stuck "uploading").
      const itemId = globalThis.crypto?.randomUUID?.() || `${file.name}-${Math.random()}`;
      setQueue((q) => [{ id: itemId, name: file.name, status: "uploading", error: null }, ...q]);
      const update = (patch) =>
        setQueue((q) => q.map((it) => (it.id === itemId ? { ...it, ...patch } : it)));
      try {
        const { id } = await uploadFile(file);
        update({ status: "done" });
        onComplete?.({
          id,
          name: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        });
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
            e.target.value = "";
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="queue">
          {queue.map((it) => (
            <li key={it.id} className={`queue-item ${it.status}`}>
              <span className="qi-name">{it.name}</span>
              {it.status === "uploading" && (
                <span className="qi-bar indet">
                  <span className="qi-fill" />
                </span>
              )}
              <span className="qi-status">
                {it.status === "uploading" && "Uploading…"}
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
