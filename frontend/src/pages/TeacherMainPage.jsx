import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherClassCard from "../components/TeacherClassCard";
import CreateClassModal from "../components/CreateClassModal";
import { getTeacherClasses, updateClass } from "../api/api";

const TeacherMainPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);

  const nav = useNavigate();

  async function load() {
    setError("");
    try {
      const data = await getTeacherClasses();
      setClasses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Chyba při načítání tříd:", err);
      setError(err?.message || "Nepodařilo se načíst třídy.");
      setClasses([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const logout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/teacher/login";
  };

  const toggleActive = async (cls) => {
    setError("");
    try {
      const updated = await updateClass(cls.id, { active: !cls.active });
      setClasses((prev) =>
        prev.map((c) => (c.id === cls.id ? { ...c, active: updated.active } : c))
      );
    } catch (e) {
      console.error(e);
      setError(e?.message || "Nepodařilo se změnit stav třídy.");
    }
  };

  const activeClasses = classes.filter((c) => c.active);
  const inactiveClasses = classes.filter((c) => !c.active);

  const plusCardStyle = {
    border: "1px dashed #3a3a3a",
    borderRadius: 16,
    padding: 16,
    background: "rgba(255,255,255,0.03)",
    minHeight: 140,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    userSelect: "none",
  };

  const plusInnerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    opacity: 0.9,
  };

  return (
    <div className="teacher-dashboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Tvé třídy</h1>
        <button onClick={logout}>Odhlásit</button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* AKTIVNÍ */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2>Aktivní</h2>
        <button onClick={() => setCreateOpen(true)}>➕ Nová třída</button>
      </div>

      <div className="class-grid">
        {activeClasses.map((c) => (
          <TeacherClassCard
            key={c.id}
            classInfo={c}
            onToggleActive={toggleActive}
            onOpen={() => nav(`/teacher/classes/${c.id}`)}
          />
        ))}

        {/* PLUS karta jako na skice */}
        <div
          role="button"
          style={plusCardStyle}
          onClick={() => setCreateOpen(true)}
          title="Vytvořit novou třídu"
        >
          <div style={plusInnerStyle}>
            <div style={{ fontSize: 44, lineHeight: 1 }}>+</div>
            <div style={{ fontWeight: 700 }}>Nová třída</div>
          </div>
        </div>
      </div>

      {/* NEAKTIVNÍ */}
      <h2 style={{ marginTop: 20 }}>Neaktivní</h2>
      <div className="class-grid">
        {inactiveClasses.map((c) => (
          <TeacherClassCard
            key={c.id}
            classInfo={c}
            onToggleActive={toggleActive}
            onOpen={() => nav(`/teacher/classes/${c.id}`)}
          />
        ))}
      </div>

      {/* MODAL */}
      <CreateClassModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load()}
      />
    </div>
  );
};

export default TeacherMainPage;
