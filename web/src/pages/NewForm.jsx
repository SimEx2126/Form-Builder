import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AUDIENCES, TEMPLATES } from "../templates.js";

// Heading shown (upper-left) for each step.
const STEP_TITLES = {
  1: "Who is this form for?",
  2: "Choose a starting point",
  3: "Do you need file uploads?",
};

// Stepped, gated wizard: 1) audience  2) starting point  3) file upload.
// Each step has Next/Back; you can't advance until the step is answered.
export default function NewForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [audience, setAudience] = useState(null);
  const [customLabel, setCustomLabel] = useState("");
  const [template, setTemplate] = useState(null); // category id or "blank"
  const [upload, setUpload] = useState(null); // true | false

  const isOther = audience === "other";
  const templates = audience && !isOther ? TEMPLATES[audience] || [] : [];

  function pickAudience(key) {
    setAudience(key);
    setTemplate(key === "other" ? "blank" : null); // "Other" has no templates
  }

  // What's needed to leave each step.
  const canLeave1 = audience && (!isOther || customLabel.trim());
  const canLeave2 = !!template;
  const canCreate = upload !== null;

  function proceed() {
    if (!canCreate) return;
    const u = upload ? 1 : 0;
    if (isOther) {
      navigate(`/build?upload=${u}&audience=${encodeURIComponent(customLabel.trim())}`);
    } else if (template === "blank") {
      navigate(`/build?upload=${u}`);
    } else {
      navigate(`/build?template=${audience}.${template}&upload=${u}`);
    }
  }

  return (
    <div>
      <div className="crumbs">
        <Link to="/">← Back to forms</Link>
      </div>
      <h1>{STEP_TITLES[step]}</h1>

      {/* Step 1 — audience */}
      {step === 1 && (
        <>
          <p className="subtitle">Pick the type of person who'll fill it out — or choose ✏️ Other.</p>
          <div className="aud-tabs">
            {AUDIENCES.map((a) => (
              <button
                key={a.key}
                className={`aud-tab ${audience === a.key ? "active" : ""}`}
                onClick={() => pickAudience(a.key)}
              >
                <span className="aud-icon">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
          {isOther && (
            <input
              className="input"
              style={{ marginTop: 12 }}
              placeholder="Type who it's for (e.g. Vendor, Alumni, Visitor)"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              autoFocus
            />
          )}
          <div className="wiz-nav">
            <span />
            <button className="btn primary" disabled={!canLeave1} onClick={() => setStep(2)}>
              Next →
            </button>
          </div>
        </>
      )}

      {/* Step 2 — starting point */}
      {step === 2 && (
        <>
          {isOther ? (
            <>
              <p className="subtitle">
                For <b>{customLabel}</b> we'll start with a blank form — you'll add your own fields next.
              </p>
            </>
          ) : (
            <>
              <p className="subtitle">Use a ready-made template, or start from blank.</p>
              <div className="template-grid">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    className={`template-card ${template === tpl.id ? "selected" : ""}`}
                    onClick={() => setTemplate(tpl.id)}
                  >
                    <div className="tc-name">{tpl.name}</div>
                    <p className="tc-desc">{tpl.description}</p>
                  </button>
                ))}
                <button
                  className={`template-card blank ${template === "blank" ? "selected" : ""}`}
                  onClick={() => setTemplate("blank")}
                >
                  <div className="tc-name">＋ Blank form</div>
                  <p className="tc-desc">Start from scratch.</p>
                </button>
              </div>
            </>
          )}
          <div className="wiz-nav">
            <button className="btn" onClick={() => setStep(1)}>← Back</button>
            <button className="btn primary" disabled={!canLeave2} onClick={() => setStep(3)}>
              Next →
            </button>
          </div>
        </>
      )}

      {/* Step 3 — upload? */}
      {step === 3 && (
        <>
          <p className="subtitle">Will respondents need to attach images, videos, or PDFs?</p>
          <div className="ua-actions">
            <button className={`btn ${upload === true ? "active" : ""}`} onClick={() => setUpload(true)}>
              📎 Yes
            </button>
            <button className={`btn ${upload === false ? "active" : ""}`} onClick={() => setUpload(false)}>
              No
            </button>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>You can change this later in the builder.</p>
          <div className="wiz-nav">
            <button className="btn" onClick={() => setStep(2)}>← Back</button>
            <button className="btn primary" disabled={!canCreate} onClick={proceed}>
              Create form →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
