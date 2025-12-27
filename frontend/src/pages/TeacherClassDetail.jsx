// src/pages/TeacherClassDetail.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getClassDetail,
  getClassTopics,
  createTopic,
  updateTopic,
  deleteTopic,
} from "../api/api";

export default function TeacherClassDetail() {
  const { classId } = useParams();
  const nav = useNavigate();

  const [cls, setCls] = useState(null);
  const [topics, setTopics] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const c = await getClassDetail(classId);
      setCls(c);

      const t = await getClassTopics(classId);
      setTopics(t);
    } catch (e) {
      console.error(e);
      setError("Nepodařilo se načíst detail třídy nebo kapitoly.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [classId]);

  const header =
    cls?.grade != null
      ? `${cls.grade}. třída – ${cls.subject}`
      : cls?.subject ?? "Třída";

  async function onAdd(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    try {
      const created = await createTopic(classId, { title, active: true });
      setTopics((prev) => [...prev, created]);
      setNewTitle("");
    } catch (e) {
      console.error(e);
      setError("Nepodařilo se přidat kapitolu.");
    }
  }

  async function onRename(topic) {
    const next = prompt("Upravit název kapitoly:", topic.title);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;

    try {
      const updated = await updateTopic(classId, topic.id, { title: trimmed });
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? updated : t)));
    } catch (e) {
      console.error(e);
      setError("Nepodařilo se upravit kapitolu.");
    }
  }

  async function onToggleActive(topic) {
    try {
      const updated = await updateTopic(classId, topic.id, { active: !topic.active });
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? updated : t)));
    } catch (e) {
      console.error(e);
      setError("Nepodařilo se změnit aktivitu kapitoly.");
    }
  }

  async function onDelete(topic) {
    if (!confirm("Opravdu smazat kapitolu?")) return;

    try {
      await deleteTopic(classId, topic.id);
      setTopics((prev) => prev.filter((t) => t.id !== topic.id));
    } catch (e) {
      console.error(e);
      setError("Nepodařilo se smazat kapitolu.");
    }
  }

  const activeTopics = topics.filter((t) => t.active);
  const inactiveTopics = topics.filter((t) => !t.active);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <button onClick={() => nav("/teacher")}>← Zpět</button>

      <h1 style={{ marginTop: 12 }}>{header}</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {loading ? (
        <p>Načítám…</p>
      ) : (
        <>
          <form onSubmit={onAdd} style={{ display: "flex", gap: 8, margin: "16px 0" }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nová kapitola (např. RGB model, Šifrování...)"
              style={{ flex: 1, padding: 10 }}
            />
            <button type="submit">Přidat</button>
          </form>

          <h2>Aktivní kapitoly</h2>
          {activeTopics.length === 0 ? (
            <p>Žádné aktivní kapitoly.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {activeTopics.map((t) => (
                <div key={t.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.title}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => onRename(t)}>Upravit</button>
                    <button onClick={() => onToggleActive(t)}>Deaktivovat</button>
                    <button onClick={() => onDelete(t)}>Smazat</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ marginTop: 20 }}>Neaktivní kapitoly</h2>
          {inactiveTopics.length === 0 ? (
            <p>Žádné neaktivní kapitoly.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {inactiveTopics.map((t) => (
                <div key={t.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, opacity: 0.7 }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>{t.title}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={() => onRename(t)}>Upravit</button>
                    <button onClick={() => onToggleActive(t)}>Aktivovat</button>
                    <button onClick={() => onDelete(t)}>Smazat</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
