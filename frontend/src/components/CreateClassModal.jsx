import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { createClass } from "../api/api";

export default function CreateClassModal({ open, onClose, onCreated }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [customName, setCustomName] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setErr("");
    setLoading(false);

    setGrade("");
    setSubject("");
    setCustomName("");
    setNote("");
    setActive(true);
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    const gradeNum = grade === "" ? null : Number(grade);

    if (!subject.trim()) {
      setErr("Předmět je povinný.");
      return;
    }
    if (gradeNum == null || Number.isNaN(gradeNum) || gradeNum <= 0) {
      setErr("Třída musí být číslo (např. 5).");
      return;
    }

    setLoading(true);
    try {
      await createClass({
        subject: subject.trim(),
        grade: gradeNum,
        custom_name: customName.trim() || null,
        note: note.trim() || null,
        active: !!active,
      });

      onCreated?.();
      onClose?.();
    } catch (e2) {
      setErr(e2?.message || "Nepodařilo se vytvořit třídu.");
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    label: { display: "block", fontSize: 12, opacity: 0.8, marginBottom: 6 },
    input: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #2b2b2b",
      background: "#0f0f0f",
      color: "#fff",
      outline: "none",
      boxSizing: "border-box",
    },
    row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    btn: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #2b2b2b",
      background: "#1b1b1b",
      color: "#fff",
      cursor: "pointer",
    },
    error: {
      marginTop: 10,
      padding: 10,
      borderRadius: 10,
      border: "1px solid #5a1f1f",
      background: "#2a1111",
      color: "#fff",
      fontSize: 13,
    },
    muted: { opacity: 0.7, fontSize: 12 },
  };

  return (
    <Modal open={open} onClose={onClose} title="Vytvořit novou třídu">
      <form onSubmit={handleSubmit}>
        <div style={styles.row2}>
          <div>
            <div style={styles.label}>Třída *</div>
            <input
              style={styles.input}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="např. 5"
              inputMode="numeric"
            />
            <div style={{ marginTop: 6, ...styles.muted }}>Číslo ročníku.</div>
          </div>

          <div>
            <div style={styles.label}>Předmět *</div>
            <input
              style={styles.input}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="např. Matematika"
            />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={styles.label}>Vlastní název (volitelné)</div>
          <input
            style={styles.input}
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="např. 5.A – Matika (příprava na test)"
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={styles.label}>Poznámka (volitelné)</div>
          <input
            style={styles.input}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="např. domácí úkoly, poznámky…"
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <input
            id="active"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          <label htmlFor="active" style={{ opacity: 0.85 }}>
            Aktivní
          </label>
        </div>

        {err && <div style={styles.error}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
          <button
            type="button"
            style={styles.btn}
            onClick={onClose}
            disabled={loading}
          >
            Zrušit
          </button>
          <button type="submit" style={styles.btn} disabled={loading}>
            ➕ Vytvořit
          </button>
        </div>
      </form>
    </Modal>
  );
}
