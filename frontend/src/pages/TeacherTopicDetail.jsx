import React, { useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { generateNotesWithFiles, regenerateNotes } from "../api/api";

export default function TeacherTopicDetail() {
  const { classId, topicId } = useParams();
  const navigate = useNavigate();

  const [duration, setDuration] = useState(45);
  const [rawText, setRawText] = useState("");
  const [files, setFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // aktuální zobrazený výsledek
  const [result, setResult] = useState(null);

  // historie verzí (bez DB)
  // { id, createdAt, label, resultSnapshot }
  const [history, setHistory] = useState([]);
  const [activeVersionId, setActiveVersionId] = useState(null);

  // finální verze (jen UI)
  const [finalVersionId, setFinalVersionId] = useState(null);

  // regen
  const [regenTarget, setRegenTarget] = useState("teacher"); // teacher|student|both
  const [userNote, setUserNote] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  // aby se verze hezky číslovaly
  const versionCounterRef = useRef(0);

  const allowed = useMemo(
    () =>
      new Set([
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
      ]),
    []
  );

  function _isPdf(f) {
    return (
      (f.type || "").toLowerCase() === "application/pdf" ||
      (f.name || "").toLowerCase().endsWith(".pdf")
    );
  }

  function _isImage(f) {
    const t = (f.type || "").toLowerCase();
    return (
      t.startsWith("image/") ||
      (f.name || "").toLowerCase().endsWith(".png") ||
      (f.name || "").toLowerCase().endsWith(".jpg") ||
      (f.name || "").toLowerCase().endsWith(".jpeg") ||
      (f.name || "").toLowerCase().endsWith(".webp")
    );
  }

  function onFilesChange(e) {
    setError("");

    const selected = Array.from(e.target.files || []);

    if (selected.length > 3) {
      setError("Maximální počet souborů je 3.");
      e.target.value = "";
      setFiles([]);
      return;
    }

    const bad = selected.find(
      (f) =>
        !allowed.has((f.type || "").toLowerCase()) && !_isPdf(f) && !_isImage(f)
    );

    if (bad) {
      setError(
        `Nepodporovaný typ souboru: ${bad.name} (${bad.type || "unknown"}).`
      );
      e.target.value = "";
      setFiles([]);
      return;
    }

    setFiles(selected);
  }

  function removeFileAt(idx) {
    setError("");
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearFiles() {
    setError("");
    setFiles([]);
  }

  // --- VERSIONING HELPERS ---
  function _snapshotResult(res, label) {
    // deep copy, aby se to neměnilo referencí
    const snapshot = JSON.parse(JSON.stringify(res));

    versionCounterRef.current += 1;
    const id = `${Date.now()}_${versionCounterRef.current}`;

    const item = {
      id,
      createdAt: new Date().toISOString(),
      label,
      resultSnapshot: snapshot,
    };

    setHistory((prev) => [item, ...prev]);
    setActiveVersionId(id);

    // pokud zatím nemáme finální verzi, nastavíme první jako "draft finální"
    // (můžeš klidně smazat, pokud to nechceš)
    if (!finalVersionId) {
      setFinalVersionId(id);
    }

    return id;
  }

  function restoreVersion(id) {
    const item = history.find((h) => h.id === id);
    if (!item) return;
    setResult(item.resultSnapshot);
    setActiveVersionId(item.id);
    setError("");
  }

  function deleteVersion(id) {
    setHistory((prev) => prev.filter((h) => h.id !== id));

    if (activeVersionId === id) setActiveVersionId(null);
    if (finalVersionId === id) setFinalVersionId(null);
  }

  function clearHistory() {
    setHistory([]);
    setActiveVersionId(null);
    setFinalVersionId(null);
  }

  function setAsFinal(id) {
    setFinalVersionId(id);
  }

  function clearFinal() {
    setFinalVersionId(null);
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("cs-CZ");
    } catch {
      return iso;
    }
  }

  const finalItem = useMemo(
    () => history.find((h) => h.id === finalVersionId) || null,
    [history, finalVersionId]
  );

  async function onRun() {
    setError("");
    setResult(null);

    if (!rawText.trim() && files.length === 0) {
      setError("Zadej text nebo nahraj soubor.");
      return;
    }

    setLoading(true);
    try {
      const data = await generateNotesWithFiles(classId, topicId, {
        duration_minutes: duration,
        raw_text: rawText,
        files,
      });

      setResult(data);

      // ulož do historie jen pokud nebylo rejected
      if (data && !data.rejected) {
        const newId = _snapshotResult(data, "Vygenerováno");
        // aktivní verze nastaví snapshot; výsledek už jsme nastavili
        setActiveVersionId(newId);
      }
    } catch (e) {
      const code = e?.code;
      if (code === "file_error") setError(`Chyba souboru: ${e.message}`);
      else setError(e?.message || "Nepodařilo se spustit workflow.");
    } finally {
      setLoading(false);
    }
  }

  async function onRegenerate() {
    setError("");

    if (!result || result.rejected) {
      setError("Nejdřív vygeneruj poznámky.");
      return;
    }
    if (!userNote.trim()) {
      setError("Napiš krátkou poznámku pro AI.");
      return;
    }
    if (!result.extracted) {
      setError("Chybí metadata (extracted). Zkus spustit workflow znovu.");
      return;
    }

    setRegenLoading(true);
    try {
      const data = await regenerateNotes(classId, topicId, {
        target: regenTarget,
        user_note: userNote,
        extracted: result.extracted,
        teacher_notes_md: result.teacher_notes_md,
        student_notes_md: result.student_notes_md,
        raw_text: rawText,
        duration_minutes: duration,
      });

      setResult(data);

      if (data && !data.rejected) {
        const newId = _snapshotResult(data, `Regenerace: ${regenTarget}`);
        setActiveVersionId(newId);
      }

      setUserNote("");
    } catch (e) {
      const code = e?.code;
      if (code === "file_error") setError(`Chyba souboru: ${e.message}`);
      else setError(e?.message || "Nepodařilo se přegenerovat poznámky.");
    } finally {
      setRegenLoading(false);
    }
  }

  // --- STYLES ---
  const btnStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #2b2b2b",
    background: "#1b1b1b",
    color: "#fff",
    cursor: "pointer",
  };

  const btnStyleDanger = {
    ...btnStyle,
    border: "1px solid #3a1f1f",
    background: "#221010",
  };

  const btnStylePrimary = {
    ...btnStyle,
    border: "1px solid #2d4a2d",
    background: "#122012",
  };

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #2b2b2b",
    background: "#0f0f0f",
    color: "#fff",
    width: "100%",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button style={btnStyle} onClick={() => navigate(-1)}>
          ← Zpět
        </button>
      </div>

      <h1 style={{ marginBottom: 10 }}>Kapitola – workflow</h1>

      <div
        style={{
          border: "1px solid #2b2b2b",
          borderRadius: 12,
          padding: 12,
          background: "#121212",
          marginBottom: 14,
          opacity: 0.9,
        }}
      >
        ⚠️ Výstup je generovaný AI. Zkontroluj fakta a letopočty před použitím ve výuce.
      </div>

      {error && (
        <div style={{ color: "#ff6b6b", marginBottom: 12, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}

      {/* FINÁLNÍ VERZE - INFO BOX */}
      {finalItem && (
        <div
          style={{
            border: "1px solid #2d4a2d",
            borderRadius: 12,
            padding: 12,
            background: "#101a10",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900 }}>⭐ Finální verze (zatím jen UI)</div>
              <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
                {finalItem.label} • {formatTime(finalItem.createdAt)}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={btnStyle} type="button" onClick={() => restoreVersion(finalItem.id)}>
                Otevřít finální
              </button>
              <button style={btnStyleDanger} type="button" onClick={clearFinal}>
                Zrušit finální
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {history.length > 0 && (
        <div
          style={{
            border: "1px solid #2b2b2b",
            borderRadius: 12,
            padding: 12,
            background: "#0f0f0f",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div style={{ fontWeight: 800 }}>Historie verzí (bez DB)</div>
            <button style={btnStyleDanger} type="button" onClick={clearHistory}>
              Smazat historii
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            {history.map((h, idx) => {
              const isActive = activeVersionId === h.id;
              const isFinal = finalVersionId === h.id;

              return (
                <div
                  key={h.id}
                  style={{
                    border: isFinal ? "1px solid #2d4a2d" : "1px solid #2b2b2b",
                    borderRadius: 10,
                    padding: "10px 10px",
                    background: isFinal ? "#121b12" : isActive ? "#141414" : "#101010",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>
                      {isFinal ? "⭐ " : ""}
                      {isActive ? "✅ " : ""}
                      Verze {history.length - idx} — {h.label}
                    </div>
                    <div style={{ opacity: 0.65, fontSize: 13 }}>
                      {formatTime(h.createdAt)}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button style={btnStyle} type="button" onClick={() => restoreVersion(h.id)}>
                      Vrátit
                    </button>

                    <button
                      style={btnStylePrimary}
                      type="button"
                      onClick={() => setAsFinal(h.id)}
                      disabled={isFinal}
                      title={isFinal ? "Toto je finální verze" : "Označit jako finální"}
                    >
                      {isFinal ? "⭐ Finální" : "Nastavit jako finální"}
                    </button>

                    <button style={btnStyleDanger} type="button" onClick={() => deleteVersion(h.id)}>
                      Smazat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 13, opacity: 0.65, marginTop: 10, lineHeight: 1.35 }}>
            Pozn.: historie je jen v paměti stránky. Po refreshi se smaže.
          </div>
        </div>
      )}

      {/* Duration */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 6, opacity: 0.85 }}>Délka hodiny (min)</div>
        <input
          type="number"
          min={5}
          max={240}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value || 45))}
          style={{ ...inputStyle, maxWidth: 220 }}
        />
      </div>

      {/* Raw text */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 6, opacity: 0.85 }}>Text od učitele</div>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Vlož sem text (např. z Wikipedie, poznámky, osnovu...)"
          style={{ ...inputStyle, minHeight: 160, resize: "vertical" }}
        />
      </div>

      {/* File upload */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 6, opacity: 0.85 }}>
          Přílohy (max 3) – PDF / obrázky (PNG/JPG/WEBP)
        </div>

        <input
          type="file"
          multiple
          accept="application/pdf,image/*"
          onChange={onFilesChange}
          style={{ color: "#fff" }}
        />

        <div style={{ fontSize: 13, opacity: 0.65, marginTop: 6, lineHeight: 1.35 }}>
          Tip: Pokud PDF nejde načíst, často je to sken bez textu. Zkus:
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            <li>nahrát sken jako obrázek (JPG/PNG), nebo</li>
            <li>z PDF zkopírovat text a vložit ho do pole „Text od učitele“.</li>
          </ul>
        </div>

        {files.length > 0 && (
          <div
            style={{
              marginTop: 10,
              border: "1px solid #2b2b2b",
              borderRadius: 12,
              padding: 10,
              background: "#101010",
            }}
          >
            <div style={{ marginBottom: 8, opacity: 0.85 }}>
              Vybrané soubory:
            </div>

            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", opacity: 0.95 }}>
              {files.map((f, idx) => {
                const icon = _isPdf(f) ? "📄" : _isImage(f) ? "🖼️" : "📎";
                return (
                  <li
                    key={`${f.name}-${f.size}-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "8px 10px",
                      border: "1px solid #2b2b2b",
                      borderRadius: 10,
                      marginBottom: 8,
                      background: "#0f0f0f",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {icon} {f.name}
                      </div>
                      <div style={{ opacity: 0.65, fontSize: 13 }}>
                        {Math.round(f.size / 1024)} KB • {f.type || "unknown"}
                      </div>
                    </div>

                    <button
                      type="button"
                      style={{ ...btnStyleDanger, padding: "8px 10px" }}
                      onClick={() => removeFileAt(idx)}
                      title="Odebrat soubor"
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>

            <button style={{ ...btnStyle, marginTop: 6 }} onClick={clearFiles} type="button">
              Odebrat všechny soubory
            </button>
          </div>
        )}
      </div>

      {/* Run */}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={btnStyle} onClick={onRun} disabled={loading}>
          {loading ? "Generuji…" : "▶ Spustit workflow"}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div style={{ marginTop: 18 }}>
          {result.rejected ? (
            <div
              style={{
                border: "1px solid #ff6b6b",
                borderRadius: 12,
                padding: 12,
                background: "#1a0f0f",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Zamítnuto kontrolorem
              </div>
              <div style={{ opacity: 0.9 }}>{result.reject_reason}</div>
            </div>
          ) : (
            <>
              {Array.isArray(result.warnings) && result.warnings.length > 0 && (
                <div
                  style={{
                    border: "1px solid #f5c542",
                    borderRadius: 12,
                    padding: 12,
                    background: "#1a160a",
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    Upozornění
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {result.warnings.map((w, i) => (
                      <li key={i} style={{ opacity: 0.9 }}>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick actions for current */}
              {activeVersionId && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <button
                    style={btnStylePrimary}
                    type="button"
                    onClick={() => setAsFinal(activeVersionId)}
                    disabled={finalVersionId === activeVersionId}
                    title="Označit aktuálně zobrazenou verzi jako finální"
                  >
                    {finalVersionId === activeVersionId ? "⭐ Aktuální je finální" : "⭐ Nastavit aktuální jako finální"}
                  </button>
                </div>
              )}

              {/* Regenerate block */}
              <div
                style={{
                  border: "1px solid #2b2b2b",
                  borderRadius: 12,
                  padding: 12,
                  background: "#0f0f0f",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 10 }}>
                  Upravit výstup poznámkou (regenerace)
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <select
                    value={regenTarget}
                    onChange={(e) => setRegenTarget(e.target.value)}
                    style={{ ...inputStyle, maxWidth: 220 }}
                  >
                    <option value="teacher">Učitel</option>
                    <option value="student">Student</option>
                    <option value="both">Oboje</option>
                  </select>
                </div>

                <textarea
                  value={userNote}
                  onChange={(e) => setUserNote(e.target.value)}
                  placeholder='Např. "udělej to víc interaktivní", "zjednoduš", "přidej víc příkladů"...'
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                />

                <button
                  style={{ ...btnStyle, marginTop: 10 }}
                  onClick={onRegenerate}
                  disabled={regenLoading || !userNote.trim()}
                >
                  {regenLoading ? "Regeneruji…" : "♻️ Přegenerovat"}
                </button>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    border: "1px solid #2b2b2b",
                    borderRadius: 12,
                    padding: 12,
                    background: "#101010",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>
                    Teacher notes
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.95 }}>
                    {result.teacher_notes_md}
                  </pre>
                </div>

                <div
                  style={{
                    border: "1px solid #2b2b2b",
                    borderRadius: 12,
                    padding: 12,
                    background: "#101010",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>
                    Student notes
                  </div>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.95 }}>
                    {result.student_notes_md}
                  </pre>
                </div>

                <div
                  style={{
                    border: "1px solid #2b2b2b",
                    borderRadius: 12,
                    padding: 12,
                    background: "#0f0f0f",
                    opacity: 0.9,
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>Metadata</div>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                    {JSON.stringify(result.extracted, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
