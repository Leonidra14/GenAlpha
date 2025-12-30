import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { generateNotesWithFiles } from "../api/api";

export default function TeacherTopicDetail() {
  const { classId, topicId } = useParams();
  const navigate = useNavigate();

  const [duration, setDuration] = useState(45);
  const [rawText, setRawText] = useState("");
  const [files, setFiles] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function onFilesChange(e) {
    setError("");
    const selected = Array.from(e.target.files || []);

    if (selected.length > 3) {
      setError("Maximální počet souborů je 3.");
      e.target.value = "";
      setFiles([]);
      return;
    }

    // povolené typy: pdf + obrázky
    const allowed = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ]);

    const bad = selected.find((f) => !allowed.has((f.type || "").toLowerCase()));
    if (bad) {
      setError(`Nepodporovaný typ souboru: ${bad.name} (${bad.type || "unknown"}).`);
      e.target.value = "";
      setFiles([]);
      return;
    }

    setFiles(selected);
  }

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
    } catch (e) {
      setError(e?.message || "Nepodařilo se spustit workflow.");
    } finally {
      setLoading(false);
    }
  }

  const btnStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #2b2b2b",
    background: "#1b1b1b",
    color: "#fff",
    cursor: "pointer",
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

      {/* Soft warning (jak jsi chtěla) */}
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
            <div style={{ marginBottom: 8, opacity: 0.85 }}>Vybrané soubory:</div>
            <ul style={{ margin: 0, paddingLeft: 18, opacity: 0.9 }}>
              {files.map((f) => (
                <li key={f.name}>
                  {f.name}{" "}
                  <span style={{ opacity: 0.65 }}>
                    ({Math.round(f.size / 1024)} KB)
                  </span>
                </li>
              ))}
            </ul>

            <button
              style={{ ...btnStyle, marginTop: 10 }}
              onClick={() => setFiles([])}
              type="button"
            >
              Odebrat soubory
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
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>Upozornění</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {result.warnings.map((w, i) => (
                      <li key={i} style={{ opacity: 0.9 }}>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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
