import React, { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { generateTopicNotes } from "../api/api";

const tabs = [
  { key: "outline", label: "Osnova - učitele" },
  { key: "student_notes", label: "Zápis pro studenty" },
  { key: "results", label: "Výsledky studentů" },
  { key: "edit_notes", label: "Vytvořit - upravit poznámky" },
];

export default function TeacherTopicDetail() {
  const { classId, topicId } = useParams();
  const nav = useNavigate();

  const [activeTab, setActiveTab] = useState("edit_notes");

  const [duration, setDuration] = useState(45);
  const [rawText, setRawText] = useState("");

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState(null);

  const pageStyle = {
    minHeight: "100vh",
    background: "#0b0f19",
    color: "white",
    padding: 20,
  };

  const cardStyle = {
    maxWidth: 1200,
    margin: "0 auto",
    background: "#101826",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
  };

  const tabBarStyle = {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
    paddingBottom: 10,
    marginBottom: 14,
  };

  const tabStyle = (active) => ({
    padding: "10px 12px",
    borderRadius: 10,
    cursor: "pointer",
    border: active ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(255,255,255,0.06)" : "transparent",
    fontSize: 14,
  });

  const labelStyle = { fontSize: 13, opacity: 0.85, marginBottom: 6 };

  const inputStyle = {
    width: "100%",
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "white",
    outline: "none",
  };

  const textareaStyle = {
    width: "100%",
    minHeight: 220,
    resize: "vertical",
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: 12,
    color: "white",
    outline: "none",
    fontFamily: "inherit",
  };

  const btnStyle = (primary) => ({
    padding: "10px 14px",
    borderRadius: 10,
    cursor: running ? "not-allowed" : "pointer",
    border: "1px solid rgba(255,255,255,0.14)",
    background: primary ? "rgba(239,68,68,0.90)" : "transparent",
    color: "white",
    opacity: running ? 0.7 : 1,
  });

  const twoCol = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };

  const boxStyle = {
    background: "#0f172a",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12,
    padding: 12,
  };

  const preStyle = {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    fontSize: 13,
    lineHeight: 1.35,
  };

  const extracted = result?.extracted;

  const extractedSummary = useMemo(() => {
    if (!extracted) return null;
    const dates = extracted.dates || [];
    const entities = extracted.entities || [];
    const events = extracted.events || [];
    const terms = extracted.terms || [];
    const claims = extracted.claims || [];
    const missing = extracted.missing || [];
    return { dates, entities, events, terms, claims, missing };
  }, [extracted]);

  async function runWorkflow() {
    setError("");
    setResult(null);

    if (!rawText.trim()) {
      setError("Prosím vlož raw text.");
      return;
    }

    setRunning(true);
    try {
      const data = await generateTopicNotes(classId, topicId, {
        duration_minutes: Number(duration) || 45,
        raw_text: rawText,
      });
      setResult(data);
    } catch (e) {
      setError(e?.message || "Nepodařilo se spustit workflow.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Kapitola – detail</div>
        <button style={btnStyle(false)} onClick={() => nav(-1)}>← Zpět</button>
      </div>

      <div style={cardStyle}>
        <div style={tabBarStyle}>
          {tabs.map((t) => (
            <div key={t.key} style={tabStyle(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </div>
          ))}
        </div>

        {activeTab !== "edit_notes" ? (
          <div style={{ opacity: 0.8, padding: 10 }}>
            Zatím prázdné (MVP). Tady později bude obsah pro: <b>{tabs.find(x => x.key === activeTab)?.label}</b>.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={labelStyle}>Délka hodiny (min)</div>
                <input
                  style={inputStyle}
                  type="number"
                  value={duration}
                  min={5}
                  max={240}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <div />
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
                <button style={btnStyle(true)} onClick={runWorkflow} disabled={running}>
                  {running ? "Běžím..." : "Run workflow"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={labelStyle}>Učitelský text (raw)</div>
              <textarea
                style={textareaStyle}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Sem vlož text od učitele… (např. z Wikipedie)"
              />
            </div>

            {error && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.35)" }}>
                {error}
              </div>
            )}

            {result && (
              <div style={{ marginTop: 14 }}>
                {/* Warnings */}
                {result.warnings?.length > 0 && (
                  <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)" }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Upozornění</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                )}

                {/* Extracted metadata */}
                <div style={{ ...boxStyle, marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Extrahované klíčové informace</div>

                  {!extractedSummary ? (
                    <div style={{ opacity: 0.8 }}>Žádná metadata.</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Časová osa / letopočty</div>
                        {extractedSummary.dates.length === 0 ? (
                          <div style={{ opacity: 0.8 }}>—</div>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {extractedSummary.dates.map((d, i) => (
                              <li key={i}>
                                <b>{d.value}</b>{d.context ? ` — ${d.context}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Osoby / entity</div>
                        {(extractedSummary.entities.length === 0 && extractedSummary.events.length === 0) ? (
                          <div style={{ opacity: 0.8 }}>—</div>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {extractedSummary.entities.map((e, i) => (
                              <li key={`en-${i}`}>{e.name} <span style={{ opacity: 0.75 }}>({e.type})</span></li>
                            ))}
                            {extractedSummary.events.map((e, i) => (
                              <li key={`ev-${i}`}>{e.name} <span style={{ opacity: 0.75 }}>({e.type})</span></li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Pojmy</div>
                        {extractedSummary.terms.length === 0 ? (
                          <div style={{ opacity: 0.8 }}>—</div>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {extractedSummary.terms.map((t, i) => (
                              <li key={i}>{t.name}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Tvrzení (explicitně z textu)</div>
                        {extractedSummary.claims.length === 0 ? (
                          <div style={{ opacity: 0.8 }}>—</div>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {extractedSummary.claims.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div style={{ gridColumn: "1 / -1" }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Chybí / nejistoty</div>
                        {extractedSummary.missing.length === 0 ? (
                          <div style={{ opacity: 0.8 }}>—</div>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {extractedSummary.missing.map((m, i) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div style={twoCol}>
                  <div style={boxStyle}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Teacher notes (MD)</div>
                    <pre style={preStyle}>{result.teacher_notes_md || "—"}</pre>
                  </div>

                  <div style={boxStyle}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Student notes (MD)</div>
                    <pre style={preStyle}>{result.student_notes_md || "—"}</pre>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
