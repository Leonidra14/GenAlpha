import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { createClass } from "../api/api";
import "./CreateClassModal.css";

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

  return (
    <Modal open={open} onClose={onClose} title="Vytvořit novou třídu">
      <form className="ccmForm" onSubmit={handleSubmit}>
        <div className="ccmRow2">
          <div>
            <div className="ccmLabel">Třída *</div>
            <div className="ccmField">
              <span className="ccmIcon" aria-hidden="true">🏫</span>
              <input
                className="ccmInput"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="např. 5"
                inputMode="numeric"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <div className="ccmLabel">Předmět *</div>
            <div className="ccmField">
              <span className="ccmIcon" aria-hidden="true">📘</span>
              <input
                className="ccmInput"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="např. Matematika"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="ccmBlock">
          <div className="ccmLabel">Vlastní název (volitelné)</div>
          <div className="ccmField">
            <span className="ccmIcon" aria-hidden="true">✨</span>
            <input
              className="ccmInput"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="např. Dívky z 5.B"
              disabled={loading}
            />
          </div>
        </div>

        <div className="ccmBlock">
          <div className="ccmLabel">Poznámka (volitelné)</div>
          <div className="ccmField">
            <span className="ccmIcon" aria-hidden="true">📝</span>
            <input
              className="ccmInput"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="např. číslo učebny…"
              disabled={loading}
            />
          </div>
        </div>

        <label className="ccmCheckRow">
          <input
            className="ccmCheckbox"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={loading}
          />
          <span>Aktivní</span>
        </label>

        {err && <div className="ccmError">{err}</div>}

        <div className="ccmActions">
          <button
            type="button"
            className="ccmBtn ghost"
            onClick={onClose}
            disabled={loading}
          >
            Zrušit
          </button>

          <button type="submit" className="ccmBtn primary" disabled={loading}>
            {loading ? "Vytvářím..." : "➕ Vytvořit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
