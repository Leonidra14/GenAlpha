import React, { useCallback, useEffect, useState } from "react";
import Modal from "./Modal";
import { createClass, getClassDetail, updateClass } from "../api/api";

/**
 * Vytvoření nové třídy (editingClassId == null) nebo úprava existující (editingClassId).
 * Stejný formulář a vzhled; edit jen načte data a volá update.
 */
export default function ClassFormModal({ open, onClose, editingClassId = null, onSuccess }) {
  const isEdit = editingClassId != null && editingClassId !== "";

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [customName, setCustomName] = useState("");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);

  const resetEmpty = useCallback(() => {
    setErr("");
    setLoading(false);
    setGrade("");
    setSubject("");
    setCustomName("");
    setNote("");
    setActive(true);
  }, []);

  const loadClass = useCallback(async () => {
    if (!editingClassId) return;
    setLoading(true);
    setErr("");
    setGrade("");
    setSubject("");
    setCustomName("");
    setNote("");
    setActive(true);
    try {
      const c = await getClassDetail(editingClassId);
      setSubject(c?.subject ?? "");
      setGrade(c?.grade != null ? String(c.grade) : "");
      setCustomName(c?.custom_name ?? "");
      setNote(c?.note ?? "");
      setActive(!!c?.active);
    } catch (e) {
      setErr(e?.message || "Nepodařilo se načíst nastavení třídy.");
    } finally {
      setLoading(false);
    }
  }, [editingClassId]);

  useEffect(() => {
    if (!open) return;
    if (isEdit) {
      loadClass();
    } else {
      resetEmpty();
    }
  }, [open, isEdit, loadClass, resetEmpty]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!subject.trim()) {
      setErr("Předmět je povinný.");
      return;
    }

    const gradeNum = grade === "" ? null : Number(grade);
    if (gradeNum == null || Number.isNaN(gradeNum) || gradeNum <= 0) {
      setErr("Třída musí být číslo (např. 5).");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        subject: subject.trim(),
        grade: gradeNum,
        custom_name: customName.trim() || null,
        note: note.trim() || null,
        active: !!active,
      };

      if (isEdit) {
        await updateClass(editingClassId, payload);
      } else {
        await createClass(payload);
      }

      onSuccess?.();
      onClose?.();
    } catch (e2) {
      setErr(
        e2?.message ||
          (isEdit ? "Nepodařilo se uložit změny." : "Nepodařilo se vytvořit třídu.")
      );
    } finally {
      setLoading(false);
    }
  }

  const title = isEdit ? "Nastavení třídy" : "Vytvořit novou třídu";
  const submitLabel = loading ? (isEdit ? "Ukládám…" : "Vytvářím…") : isEdit ? "Uložit" : "➕ Vytvořit";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form className="gaModalForm" onSubmit={handleSubmit}>
        <div className="gaModalRow2Wide">
          <div>
            <div className="gaModalLabel">Třída *</div>
            <div className="gaModalIconField">
              <input
                className="gaModalInputPlain"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="např. 5"
                inputMode="numeric"
                disabled={loading}
                type="number"
                min={1}
                max={20}
              />
            </div>
          </div>

          <div>
            <div className="gaModalLabel">Předmět *</div>
            <div className="gaModalIconField">
              <input
                className="gaModalInputPlain"
                maxLength={100}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="např. Matematika"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="gaModalFieldGap">
          <div className="gaModalLabel">Vlastní název (volitelné)</div>
          <div className="gaModalIconField">
            <input
              className="gaModalInputPlain"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="např. Dívky z 5.B"
              disabled={loading}
              maxLength={100}
            />
          </div>
        </div>

        <div className="gaModalFieldGap">
          <div className="gaModalLabel">Poznámka (volitelné)</div>
          <div className="gaModalIconField">
            <input
              className="gaModalInputPlain"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="např. číslo učebny…"
              disabled={loading}
              maxLength={255}
            />
          </div>
        </div>

        <label className="gaModalCheckLabel">
          <input
            className="gaModalCheckSm"
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={loading}
          />
          <span>Třída je aktivní</span>
        </label>

        {err && <div className="gaModalError">{err}</div>}

        <div className="gaModalActions">
          <button type="button" className="tcdBtn" onClick={onClose} disabled={loading}>
            Zrušit
          </button>

          <button type="submit" className="tcdBtn primary" disabled={loading}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
