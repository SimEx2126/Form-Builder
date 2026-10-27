import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { createForm, updateForm, getForm } from "../api.js";
import { findTemplate, audienceLabel } from "../templates.js";

// Field types offered in the builder.
const TYPES = [
  { type: "short_text", label: "Short text" },
  { type: "name", label: "Name" },
  { type: "long_text", label: "Long text" },
  { type: "email", label: "Email" },
  { type: "dropdown", label: "Dropdown" },
  { type: "multiple_choice", label: "Multiple choice" },
  // File upload is kept for display (templates may include it) but is not
  // offered as a manually-addable field — hence addable: false.
  { type: "file", label: "File upload", addable: false },
];
const ADDABLE = TYPES.filter((t) => t.addable !== false);
const CHOICE = ["dropdown", "multiple_choice"];
const labelFor = (t) => TYPES.find((x) => x.type === t)?.label || t;
const uid = () =>
  globalThis.crypto?.randomUUID?.() || `f_${Math.random().toString(36).slice(2)}`;

export default function Builder() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editing = !!id;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState(null);
  const [category, setCategory] = useState(null);
  const [fields, setFields] = useState([]);
  const [formVersion, setFormVersion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [flashId, setFlashId] = useState(null); // briefly highlights a moved field
  const [removingId, setRemovingId] = useState(null); // field animating out
  const [enterId, setEnterId] = useState(null); // field animating in when added
  const flipRef = useRef(null); // holds pre-swap positions for the move animation

  // Editing an existing form: load it.
  useEffect(() => {
    if (!editing) return;
    getForm(id)
      .then((f) => {
        setTitle(f.title);
        setDescription(f.description || "");
        setAudience(f.audience || null);
        setCategory(f.category || null);
        setFields(f.fields);
        setFormVersion(f.version ?? null);
      })
      .catch((e) => setError(e.message));
  }, [id, editing]);

  // New form: pre-fill from a template (if any), then apply the upload answer —
  // "1" ensures a file field exists, "0" removes any.
  useEffect(() => {
    if (editing) return;
    const upload = searchParams.get("upload"); // "1" | "0" | null
    const found = findTemplate(searchParams.get("template"));

    let nextFields = [];
    if (found) {
      setAudience(found.audience);
      setCategory(found.category.name);
      setTitle(`${audienceLabel(found.audience)} – ${found.category.name}`);
      setDescription(found.category.description || "");
      nextFields = found.category.fields.map((f) => ({ ...f, id: uid() }));
    } else if (searchParams.get("audience")) {
      // Custom "Other" audience the creator typed in themselves.
      setAudience(searchParams.get("audience"));
    }

    if (upload === "1" && !nextFields.some((f) => f.type === "file")) {
      nextFields = [
        ...nextFields,
        { id: uid(), type: "file", label: "Upload files / documents", required: false },
      ];
    } else if (upload === "0") {
      nextFields = nextFields.filter((f) => f.type !== "file");
    }
    setFields(nextFields);
  }, [editing, searchParams]);

  // When a field is added, scroll it into view so the entrance animation shows.
  useEffect(() => {
    if (!enterId) return;
    document
      .getElementById(`field-${enterId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [enterId]);

  // FLIP: after a move swaps the order, slide both rows from their old
  // positions to their new ones so they appear to switch places.
  useLayoutEffect(() => {
    const flip = flipRef.current;
    if (!flip) return;
    flipRef.current = null;
    flip.ids.forEach((id) => {
      const el = document.getElementById(`field-${id}`);
      if (!el || flip.tops[id] == null) return;
      const delta = flip.tops[id] - el.getBoundingClientRect().top;
      if (!delta) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      el.getBoundingClientRect(); // force reflow so the start position sticks
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.25s ease";
        el.style.transform = "";
      });
      const clear = () => {
        el.style.transition = "";
        el.removeEventListener("transitionend", clear);
      };
      el.addEventListener("transitionend", clear);
    });
  }, [fields]);

  function addField(type) {
    const defaultLabels = { name: "Name" };
    const field = { id: uid(), type, label: defaultLabels[type] || "", required: false };
    if (CHOICE.includes(type)) field.options = ["Option 1"];
    setFields((fs) => [...fs, field]);
    // Animate the new field in (as if it flew over from the palette).
    setEnterId(field.id);
    setTimeout(() => setEnterId((cur) => (cur === field.id ? null : cur)), 400);
  }
  function patchField(fid, patch) {
    setFields((fs) => fs.map((f) => (f.id === fid ? { ...f, ...patch } : f)));
  }
  function removeField(fid) {
    // Let the row animate out, then actually remove it.
    setRemovingId(fid);
    setTimeout(() => {
      setFields((fs) => fs.filter((f) => f.id !== fid));
      setRemovingId((cur) => (cur === fid ? null : cur));
    }, 260);
  }
  function move(fid, dir) {
    const i = fields.findIndex((f) => f.id === fid);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= fields.length) return;
    const otherId = fields[j].id;

    // Capture both rows' screen positions BEFORE the swap (FLIP step 1).
    const tops = {};
    [fid, otherId].forEach((id) => {
      const el = document.getElementById(`field-${id}`);
      if (el) tops[id] = el.getBoundingClientRect().top;
    });
    flipRef.current = { ids: [fid, otherId], tops };

    setFields((fs) => {
      const copy = [...fs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }
  function clearAll() {
    if (!fields.length && !title && !description) return;
    if (!window.confirm("Clear everything and start over? This can't be undone.")) return;
    setTitle("");
    setDescription("");
    setAudience(null);
    setCategory(null);
    setFields([]);
    setError(null);
  }

  async function save() {
    setError(null);
    if (!title.trim()) return setError("Please give the form a title.");
    if (fields.length === 0) return setError("Add at least one field.");
    if (fields.some((f) => !f.label.trim())) return setError("Every field needs a label.");
    if (fields.some((f) => CHOICE.includes(f.type) && !(f.options || []).some((o) => o.trim())))
      return setError("Choice fields need at least one option.");

    setSaving(true);
    try {
      const payload = { title, description, audience, category, fields };
      if (editing && formVersion != null) payload.version = formVersion;
      const saved = editing ? await updateForm(id, payload) : await createForm(payload);
      if (saved.version != null) setFormVersion(saved.version);
      navigate(`/forms/${saved.id}/responses`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="builder">
      <div className="builder-layout">
        <aside className="builder-sidebar">
          <div className="crumbs">
            <Link to="/">← Back</Link>
          </div>
          <h1>{editing ? "Edit form" : "New form"}</h1>
          {(audience || category) && (
            <p className="builder-badge">
              {audience && <span className="badge">{audienceLabel(audience)}</span>}
              {category && <span className="badge soft">{category}</span>}
            </p>
          )}
          <div className="add-label">Add field</div>
          <div className="palette">
            {ADDABLE.map((t) => (
              <button key={t.type} className="btn palette-btn" onClick={() => addField(t.type)}>
                + {t.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="builder-main">
      <label className="lbl">Form title</label>
      <input
        className="input big"
        placeholder="e.g. Volunteer Application"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className="lbl">Description (optional)</label>
      <textarea
        className="input"
        rows={2}
        placeholder="Shown to people filling out the form"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <h2 className="section">Fields</h2>
      {fields.length === 0 && <p className="muted">No fields yet — add some below.</p>}

      <ul className="field-list">
        {fields.map((f, i) => (
          <li
            key={f.id}
            id={`field-${f.id}`}
            className={`field-edit${flashId === f.id ? " flash" : ""}${
              removingId === f.id ? " removing" : ""
            }${enterId === f.id ? " entering" : ""}`}
          >
            <div className="fe-head">
              <span className="fe-type">{labelFor(f.type)}</span>
              <div className="fe-tools">
                <button className="icon" title="Move up" onClick={() => move(f.id, -1)} disabled={i === 0}>↑</button>
                <button className="icon" title="Move down" onClick={() => move(f.id, 1)} disabled={i === fields.length - 1}>↓</button>
                <button className="icon danger" title="Delete" onClick={() => removeField(f.id)}>✕</button>
              </div>
            </div>

            <input
              className="input"
              placeholder="Question / label"
              value={f.label}
              onChange={(e) => patchField(f.id, { label: e.target.value })}
            />

            {CHOICE.includes(f.type) && (
              <OptionsEditor
                options={f.options || []}
                onChange={(options) => patchField(f.id, { options })}
              />
            )}

            {(f.type === "name" || f.type === "full_name") && (
              <div className="name-row" aria-hidden="true">
                <input className="input" placeholder="First Name" disabled />
                <input className="input" placeholder="Last Name" disabled />
              </div>
            )}

            <label className="checkbox">
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => patchField(f.id, { required: e.target.checked })}
              />
              Required
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="error">{error}</p>}

      <div className="save-bar">
        <button className="btn primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Create form"}
        </button>
        <Link to="/" className="btn">Cancel</Link>
        <button type="button" className="btn clear" onClick={clearAll}>
          Clear form
        </button>
      </div>
        </div>
      </div>
    </div>
  );
}

function OptionsEditor({ options, onChange }) {
  const set = (i, val) => onChange(options.map((o, idx) => (idx === i ? val : o)));
  const add = () => onChange([...options, `Option ${options.length + 1}`]);
  const remove = (i) => onChange(options.filter((_, idx) => idx !== i));
  return (
    <div className="options">
      {options.map((o, i) => (
        <div className="option-row" key={i}>
          <span className="bullet">•</span>
          <input className="input" value={o} onChange={(e) => set(i, e.target.value)} />
          <button className="icon danger" onClick={() => remove(i)} disabled={options.length <= 1}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={add}>+ Add option</button>
    </div>
  );
}
