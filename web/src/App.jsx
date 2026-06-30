import { useEffect, useState } from "react";
import FileSubmission from "./FileSubmission.jsx";
import { listSubmissions, getDownloadUrl } from "./api.js";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes,
    i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setRows(await listSubmissions());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function open(id) {
    const { url } = await getDownloadUrl(id);
    window.open(url, "_blank", "noopener");
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>File Submissions</h1>
        <p className="subtitle">Upload images, videos, and PDFs.</p>
      </header>

      <FileSubmission onUploaded={refresh} />

      <section className="list">
        <div className="list-head">
          <h2>Submissions</h2>
          <button className="ghost" onClick={refresh}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No submissions yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Size</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-name">{r.filename}</td>
                  <td>{r.contentType}</td>
                  <td>{formatSize(r.size)}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="link" onClick={() => open(r.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
