import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getForm, submitResponse } from "../api.js";
import FileSubmission from "../components/FileSubmission.jsx";

export default function FillForm() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getForm(id)
      .then(setForm)
      .catch((e) => setError(e.message));
  }, [id]);

  const setAnswer = (fid, value) => setAnswers((a) => ({ ...a, [fid]: value }));

  function toggleChoice(fid, option) {
    setAnswers((a) => {
      const cur = Array.isArray(a[fid]) ? a[fid] : [];
      return {
        ...a,
        [fid]: cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option],
      };
    });
  }

  function addFile(fid, meta) {
    setAnswers((a) => ({ ...a, [fid]: [...(a[fid] || []), meta] }));
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    // Client-side required check (server re-checks too).
    const missing = form.fields
      .filter((f) => f.required)
      .filter((f) => {
        const v = answers[f.id];
        return (
          v == null ||
          (typeof v === "string" && !v.trim()) ||
          (Array.isArray(v) && !v.length) ||
          (typeof v === "object" && !Array.isArray(v) &&
            Object.values(v).every((x) => !String(x ?? "").trim()))
        );
      })
      .map((f) => f.label);
    if (missing.length) return setError(`Please complete: ${missing.join(", ")}`);

    setSubmitting(true);
    try {
      await submitResponse(id, answers);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !form) return <p className="error">{error}</p>;
  if (!form) return <p className="muted">Loading…</p>;

  if (done)
    return (
      <div className="thanks">
        <div className="check">✓</div>
        <h1>Thank you!</h1>
        <p className="muted">Your response to “{form.title}” has been submitted.</p>
        <button
          className="btn"
          onClick={() => {
            setAnswers({});
            setDone(false);
          }}
        >
          Submit another response
        </button>
      </div>
    );

  return (
    <form className="fill" onSubmit={submit}>
      <h1>{form.title}</h1>
      {form.description && <p className="subtitle">{form.description}</p>}

      {form.fields.map((f) => (
        <div key={f.id} className="field">
          <label className="field-label">
            {f.label}
            {f.required && <span className="req"> *</span>}
          </label>

          {f.type === "short_text" && (
            <input className="input" value={answers[f.id] || ""} onChange={(e) => setAnswer(f.id, e.target.value)} />
          )}

          {f.type === "long_text" && (
            <textarea className="input" rows={4} value={answers[f.id] || ""} onChange={(e) => setAnswer(f.id, e.target.value)} />
          )}

          {f.type === "email" && (
            <input type="email" className="input" value={answers[f.id] || ""} onChange={(e) => setAnswer(f.id, e.target.value)} />
          )}

          {(f.type === "name" || f.type === "full_name") && (
            <div className="name-row">
              <input
                className="input"
                placeholder="First name"
                value={answers[f.id]?.first || ""}
                onChange={(e) => setAnswer(f.id, { ...(answers[f.id] || {}), first: e.target.value })}
              />
              <input
                className="input"
                placeholder="Last name"
                value={answers[f.id]?.last || ""}
                onChange={(e) => setAnswer(f.id, { ...(answers[f.id] || {}), last: e.target.value })}
              />
            </div>
          )}

          {f.type === "dropdown" && (
            <select className="input" value={answers[f.id] || ""} onChange={(e) => setAnswer(f.id, e.target.value)}>
              <option value="">— Select —</option>
              {f.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}

          {f.type === "multiple_choice" && (
            <div className="choices">
              {f.options.map((o) => (
                <label key={o} className="checkbox">
                  <input
                    type="checkbox"
                    checked={(answers[f.id] || []).includes(o)}
                    onChange={() => toggleChoice(f.id, o)}
                  />
                  {o}
                </label>
              ))}
            </div>
          )}

          {f.type === "file" && (
            <div>
              <FileSubmission onComplete={(meta) => addFile(f.id, meta)} />
              {(answers[f.id] || []).length > 0 && (
                <ul className="uploaded">
                  {(answers[f.id] || []).map((m) => (
                    <li key={m.id}>📎 {m.name}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}

      {error && <p className="error">{error}</p>}

      <div className="save-bar">
        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </button>
        <Link to="/" className="btn">Cancel</Link>
      </div>
    </form>
  );
}
