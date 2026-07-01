import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listForms } from "../api.js";

export default function Home() {
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    listForms()
      .then(setForms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function copyLink(id) {
    const url = `${window.location.origin}/f/${id}`;
    navigator.clipboard?.writeText(url);
    alert(`Shareable link copied:\n${url}`);
  }

  return (
    <div>
      <h1>Your forms</h1>
      <p className="subtitle">Create forms, share a link, and collect responses (with optional file uploads).</p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : forms.length === 0 ? (
        <div className="empty">
          <p>No forms yet.</p>
          <Link to="/new" className="btn primary">
            + Create your first form
          </Link>
        </div>
      ) : (
        <ul className="form-list">
          {forms.map((f) => (
            <li key={f.id} className="form-card">
              <div className="fc-main">
                <Link to={`/f/${f.id}`} className="fc-title">
                  {f.title}
                </Link>
                {f.description && <p className="fc-desc">{f.description}</p>}
                <p className="fc-meta">
                  {f.audience && <span className="badge">{f.audience}</span>}
                  {f.category && <span className="badge soft">{f.category}</span>}
                  {(f.audience || f.category) && " · "}
                  {f.fields.length} field{f.fields.length !== 1 ? "s" : ""} ·{" "}
                  {f.responseCount} response{f.responseCount !== 1 ? "s" : ""}
                  {f.fields.some((x) => x.type === "file") && " · 📎 has file upload"}
                </p>
              </div>
              <div className="fc-actions">
                <Link to={`/f/${f.id}`} className="btn">Open</Link>
                <Link to={`/forms/${f.id}/responses`} className="btn">Responses</Link>
                <Link to={`/build/${f.id}`} className="btn">Edit</Link>
                <button className="btn" onClick={() => copyLink(f.id)}>Copy link</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
