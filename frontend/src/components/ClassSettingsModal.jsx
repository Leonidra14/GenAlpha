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

  // ✅ glass/light style
  const styles = {
    section: {
      padding: 14,
      borderRadius: 18,
      border: "1px solid rgba(90,120,255,0.18)",
      background: "rgba(255,255,255,0.72)",
      boxShadow:
        "0 14px 28px rgba(26,52,160,0.10), inset 0 1px 0 rgba(255,255,255,0.65)",
      backdropFilter: "blur(10px)",
      marginBottom: 12,
      color: "rgba(35,36,58,0.92)",
    },
    label: {
      display: "block",
      fontSize: 12,
      color: "rgba(35,36,58,0.65)",
      marginBottom: 6,
      fontWeight: 800,
    },
    input: {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(120,130,180,0.22)",
      background: "rgba(255,255,255,0.78)",
      color: "rgba(35,36,58,0.92)",
      outline: "none",
      boxSizing: "border-box",
      boxShadow: "0 10px 18px rgba(60,80,190,0.08)",
    },
    row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },

    // buttons
    btnGhost: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(130,140,190,0.30)",
      background: "rgba(255,255,255,0.65)",
      color: "rgba(35,36,58,0.78)",
      cursor: "pointer",
      fontWeight: 900,
      boxShadow: "0 10px 18px rgba(60,80,190,0.10)",
      whiteSpace: "nowrap",
    },
    btnPrimary: {
      padding: "10px 12px",
      borderRadius: 12,
      border: 0,
      background: "linear-gradient(90deg, #3f6bff, #6a5cff)",
      color: "#fff",
      cursor: "pointer",
      fontWeight: 900,
      boxShadow: "0 16px 26px rgba(63,107,255,0.22)",
      whiteSpace: "nowrap",
    },

    error: {
      marginTop: 10,
      padding: 10,
      borderRadius: 14,
      border: "1px solid rgba(255,120,120,0.35)",
      background: "rgba(255,230,230,0.75)",
      color: "rgba(150,20,20,0.95)",
      fontSize: 13,
      fontWeight: 800,
    },

    // checkbox row
    checkRow: {
      marginTop: 10,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 14,
      border: "1px solid rgba(120,130,180,0.18)",
      background: "rgba(255,255,255,0.55)",
    },
    checkText: { color: "rgba(35,36,58,0.78)", fontWeight: 800 },
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
                disabled={loading}
                type="number"
                min={1}
                max={20}
              />
            </div>

            <div>
              <div style={styles.label}>Předmět</div>
              <input
                style={styles.input}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Např. Informatika"
                disabled={loading}
                maxLength={100}
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
              disabled={loading}
              maxLength={100}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={styles.label}>Poznámka (volitelné)</div>
            <input
              style={styles.input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Např. domácí úkoly…"
              disabled={loading}
              maxLength={255}
            />
          </div>

          <div style={styles.checkRow}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={loading}
              style={{ width: 18, height: 18 }}
            />
            <div style={styles.checkText}>Třída je aktivní</div>
          </div>

          {err && <div style={styles.error}>{err}</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            style={styles.btnGhost}
            onClick={onClose}
            disabled={loading}
          >
            Zrušit
          </button>

          <button type="submit" style={styles.btnPrimary} disabled={loading}>
            {loading ? "Ukládám..." : "Uložit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
