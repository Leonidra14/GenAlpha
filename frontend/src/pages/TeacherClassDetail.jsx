import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getClassDetail,
  getClassTopics,
  createTopic,
  updateTopic,
  deleteTopic,
} from "../api/api";

import ClassSettingsModal from "../components/ClassSettingsModal";
import ClassStudentsModal from "../components/ClassStudentsModal";

export default function TeacherClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [cls, setCls] = useState(null);
  const [topics, setTopics] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);

  function openTopic(topicId) {
    navigate(`/teacher/classes/${classId}/topics/${topicId}`);
  }

  async function load() {
    setError("");
    setLoading(true);
    try {
      const c = await getClassDetail(classId);
      const t = await getClassTopics(classId);
      setCls(c);
      setTopics(t || []);
    } catch (e) {
      setError(e?.message || "Nepodařilo se načíst třídu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function onAddTopic(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await createTopic(classId, { title: newTitle.trim() });
      setNewTitle("");
      await load();
    } catch (e) {
      alert(e?.message || "Nepodařilo se vytvořit kapitolu.");
    }
  }

  async function onToggleTopic(topic) {
    try {
      await updateTopic(classId, topic.id, {
        title: topic.title,
        active: !topic.active,
      });
      await load();
    } catch (e) {
      alert(e?.message || "Nepodařilo se změnit stav kapitoly.");
    }
  }

  async function onDeleteTopic(topic) {
    const ok = window.confirm("Opravdu chceš tuto kapitolu smazat?");
    if (!ok) return;

    try {
      await deleteTopic(classId, topic.id);
      await load();
    } catch (e) {
      alert(e?.message || "Nepodařilo se smazat kapitolu.");
    }
  }

  if (loading) return <div>Načítám…</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;
  if (!cls) return null;

  const title =
    cls.custom_name && cls.custom_name.trim()
      ? cls.custom_name
      : cls.grade != null
      ? `${cls.grade}. třída – ${cls.subject}`
      : `Třída – ${cls.subject}`;

  const btnStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #2b2b2b",
    background: "#1b1b1b",
    color: "#fff",
    cursor: "pointer",
  };

  const topicStyle = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #2b2b2b",
    marginBottom: 8,
    display: "flex",
    justifyContent: "space-between",
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* HLAVIČKA */}
      <h1 style={{ marginBottom: 6 }}>{title}</h1>

      {cls.note && cls.note.trim() && (
        <div style={{ marginBottom: 8, opacity: 0.85 }}>{cls.note}</div>
      )}

      <div style={{ fontSize: 14, opacity: 0.7 }}>
        Třída: {cls.grade ?? "—"}
      </div>
      <div style={{ fontSize: 14, opacity: 0.7 }}>
        Předmět: {cls.subject}
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button style={btnStyle} onClick={() => setSettingsOpen(true)}>
          ⚙️ Nastavení
        </button>

        <button style={btnStyle} onClick={() => setStudentsOpen(true)}>
          👩‍🎓 Studenti ({cls.num_students ?? 0})
        </button>

        <button style={btnStyle} onClick={() => navigate("/teacher")}>
          ← Zpět
        </button>
      </div>

      {/* TOPICS */}
      <div style={{ marginTop: 30 }}>
        <h2>Kapitoly</h2>

        {/* ADD TOPIC */}
        <form onSubmit={onAddTopic} style={{ marginBottom: 16 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Název nové kapitoly"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #2b2b2b",
              background: "#0f0f0f",
              color: "#fff",
              width: 300,
              marginRight: 8,
            }}
          />
          <button style={btnStyle} type="submit">
            ➕ Přidat
          </button>
        </form>

        {/* ACTIVE */}
        <h3>Aktivní</h3>
        {topics.filter((t) => t.active).length === 0 && (
          <div style={{ opacity: 0.6 }}>Žádné aktivní kapitoly</div>
        )}

        {topics
          .filter((t) => t.active)
          .map((t) => (
            <div
              key={t.id}
              style={topicStyle}
              onClick={() => openTopic(t.id)}
            >
              <div style={{ fontWeight: 700 }}>{t.title}</div>

              <div
                style={{ display: "flex", gap: 8 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button style={btnStyle} onClick={() => onToggleTopic(t)}>
                  Deaktivovat
                </button>
                <button style={btnStyle} onClick={() => onDeleteTopic(t)}>
                  Smazat
                </button>
              </div>
            </div>
          ))}

        {/* INACTIVE */}
        <h3 style={{ marginTop: 20 }}>Neaktivní</h3>
        {topics.filter((t) => !t.active).length === 0 && (
          <div style={{ opacity: 0.6 }}>Žádné neaktivní kapitoly</div>
        )}

        {topics
          .filter((t) => !t.active)
          .map((t) => (
            <div
              key={t.id}
              style={{ ...topicStyle, opacity: 0.7 }}
              onClick={() => openTopic(t.id)}
            >
              <div style={{ fontWeight: 700 }}>{t.title}</div>

              <div
                style={{ display: "flex", gap: 8 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button style={btnStyle} onClick={() => onToggleTopic(t)}>
                  Aktivovat
                </button>
                <button style={btnStyle} onClick={() => onDeleteTopic(t)}>
                  Smazat
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* MODALS */}
      <ClassSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        classId={classId}
        onSaved={() => load()}
      />

      <ClassStudentsModal
        open={studentsOpen}
        onClose={() => setStudentsOpen(false)}
        classId={classId}
        onChanged={() => load()}
      />
    </div>
  );
}
