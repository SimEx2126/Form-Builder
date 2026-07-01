import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { listResponses, getDownloadUrl } from "../api.js";

export default function Responses() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    listResponses(id)
      .then(setData)
      .catch((e) => setError(e.message));
  }
  useEffect(load, [id]);

  async function openFile(fileId) {
    try {
      const { url } = await getDownloadUrl(fileId);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      alert(e.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;

  const { form, responses } = data;
  const shareUrl = `${window.location.origin}/f/${form.id}`;

  return (
    <div>
      <div className="crumbs">
        <Link to="/">← Back</Link>
      </div>

      <div className="resp-head">
        <div>
          <h1>{form.title}</h1>
          <p className="subtitle">
            {responses.length} response{responses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="resp-actions">
          <Link to={`/f/${form.id}`} className="btn">Open form</Link>
          <Link to={`/build/${form.id}`} className="btn">Edit</Link>
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(shareUrl); alert(`Link copied:\n${shareUrl}`); }}>
            Copy link
          </button>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {responses.length === 0 ? (
        <p className="muted">No responses yet. Share the link to start collecting.</p>
      ) : (
        <ul className="resp-list">
          {responses.map((r) => (
            <li key={r.id} className="resp-card">
              <div className="resp-when">{new Date(r.createdAt).toLocaleString()}</div>
              <dl className="resp-answers">
                {form.fields.map((f) => (
                  <div className="resp-row" key={f.id}>
                    <dt>{f.label}</dt>
                    <dd>{renderAnswer(f, r.answers[f.id], openFile)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function renderAnswer(field, value, openFile) {
  if (value == null || (Array.isArray(value) && value.length === 0) || value === "")
    return <span className="muted">—</span>;

  if (field.type === "file") {
    return (
      <ul className="answer-files">
        {value.map((m) => (
          <li key={m.id}>
            <button className="link" onClick={() => openFile(m.id)}>📎 {m.name}</button>
          </li>
        ))}
      </ul>
    );
  }
  if (field.type === "multiple_choice") return value.join(", ");
  if (field.type === "name" || field.type === "full_name")
    return `${value.first || ""} ${value.last || ""}`.trim() || "—";
  return String(value);
}
