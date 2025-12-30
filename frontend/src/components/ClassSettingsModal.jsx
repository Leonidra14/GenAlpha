import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { getClassDetail, updateClass } from "../api/api";

export default function ClassSettingsModal({ open, onClose, classId, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [customName, setCustomName] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);

  async function load() {
    if (!classId) return;
    setLoading(true);
    setErr("");
    try {
      const c = await getClassDetail(classId);
      setSubject(c?.subject ?? "");
      setGrade(c?.grade ?? "");
      setCustomName(c?.custom_name ?? "");
      setNote(c?.note ?? "");
      setActive(!!c?.active);
    } catch (e) {
      setErr(e?.message || "Nepodařilo se načíst nastavení třídy.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, classId]);

  async function onSave(e) {
    e.preventDefault();
    setErr("");

    if (!subject.trim()) {
      setErr("Předmět je povinný.");
      return;
    }
    if (grade === "" || grade === null) {
      setErr("Třída (grade) je povinná.");
      return;
    }

    setLoading(true);
    try {
      await updateClass(classId, {
        subject: subject.trim(),
        grade: Number(grade),
        custom_name: customName.trim() || null,
        note: note.trim() || null,
        active,
      });
      onSaved?.();
      onClose();
    } catch (e2) {
      setErr(e2?.message || "Nepodařilo se uložit změny.");
    } finally {
      setLoading(false);
    }
  }

  const styles = {
    section: {
      padding: 12,
      borderRadius: 12,
      border: "1px solid #2a2a2a",
      background: "#141414",
      marginBottom: 12,
    },
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
    row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  };

  return (
    <Modal open={open} onClose={onClose} title="Nastavení třídy">
      <form onSubmit={onSave}>
        <div style={styles.section}>
          <div style={styles.row2}>
            <div>
              <div style={styles.label}>Třída (grade)</div>
              <input
                style={styles.input}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                inputMode="numeric"
                placeholder="Např. 5"
              />
            </div>

            <div>
              <div style={styles.label}>Předmět</div>
              <input
                style={styles.input}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Např. Informatika"
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={styles.label}>Vlastní název (volitelné)</div>
            <input
              style={styles.input}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Např. Bibecci"
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={styles.label}>Poznámka (volitelné)</div>
            <input
              style={styles.input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Např. domácí úkoly…"
            />
          </div>

          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <div style={{ opacity: 0.85 }}>Třída je aktivní</div>
          </div>

          {err && <div style={styles.error}>{err}</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" style={styles.btn} onClick={onClose} disabled={loading}>
            Zrušit
          </button>
          <button type="submit" style={styles.btn} disabled={loading}>
            Uložit
          </button>
        </div>
      </form>
    </Modal>
  );
}
