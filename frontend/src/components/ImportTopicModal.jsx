import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { getTeacherClasses, getClassTopics, importTopic } from "../api/api";

export default function ImportTopicModal({ open, onClose, targetClassId, onImported }) {
  const [classes, setClasses] = useState([]);
  const [sourceClassId, setSourceClassId] = useState("");
  const [topics, setTopics] = useState([]);
  const [sourceTopicId, setSourceTopicId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setError("");
    setLoading(true);

    getTeacherClasses()
      .then((data) => {
        // nechci nabízet cílovou třídu jako zdroj
        setClasses(data.filter((c) => String(c.id) !== String(targetClassId)));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, targetClassId]);

  useEffect(() => {
    if (!sourceClassId) {
      setTopics([]);
      setSourceTopicId("");
      return;
    }

    setError("");
    setLoading(true);

    getClassTopics(sourceClassId)
      .then((data) => setTopics(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sourceClassId]);

  async function handleImport() {
    if (!sourceTopicId) {
      setError("Vyber kapitolu.");
      return;
    }

    try {
      setError("");
      setLoading(true);
      await importTopic(targetClassId, Number(sourceTopicId));
      onImported?.(); // typicky load()
      onClose();
    } catch (e) {
      setError(e.message || "Import se nezdařil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nahrát kapitolu z jiné třídy">
      {error && <div className="error">{error}</div>}

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          Zdrojová třída
          <select value={sourceClassId} onChange={(e) => setSourceClassId(e.target.value)}>
            <option value="">— vyber —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.title || `Třída #${c.id}`}
              </option>
            ))}
          </select>
        </label>

        <label>
          Kapitola
          <select
            value={sourceTopicId}
            onChange={(e) => setSourceTopicId(e.target.value)}
            disabled={!sourceClassId}
          >
            <option value="">— vyber —</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Zrušit
          </button>
          <button className="btn-primary" onClick={handleImport} disabled={loading}>
            {loading ? "Načítám..." : "Nahrát"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
