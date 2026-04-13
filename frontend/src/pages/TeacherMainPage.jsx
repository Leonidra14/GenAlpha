import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherClassCard from "../components/TeacherClassCard";
import ClassFormModal from "../components/ClassFormModal";
import ClassListPageLayout from "../components/layout/ClassListPageLayout";
import { getTeacherClasses, updateClass } from "../api/api";
import "./MainPage.css";

import { useLogout } from "../hooks/useLogout";

const TeacherMainPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const nav = useNavigate();

  const handleLogout = useLogout();

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

  return (
    <ClassListPageLayout onLogout={handleLogout} title="Tvé třídy" error={error}>
        <h2 className="tmainSectionTitle">Aktivní</h2>
        <div className="tmainGrid">
          {activeClasses.map((c) => (
            <TeacherClassCard
              key={c.id}
              classInfo={c}
              onToggleActive={toggleActive}
              onOpen={() => nav(`/teacher/classes/${c.id}`)}
            />
          ))}

          <button
            type="button"
            className="tmainAddCard"
            onClick={() => setCreateOpen(true)}
            title="Vytvořit novou třídu"
          >
            <div className="tmainAddPlus">+</div>
            <div className="tmainAddLabel">Nová třída</div>
          </button>
        </div>

        <h2 className="tmainSectionTitle muted">Neaktivní</h2>
        <div className="tmainGrid">
          {inactiveClasses.map((c) => (
            <TeacherClassCard
              key={c.id}
              classInfo={c}
              onToggleActive={toggleActive}
              onOpen={() => nav(`/teacher/classes/${c.id}`)}
            />
          ))}
        </div>

        <ClassFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => load()}
        />
    </ClassListPageLayout>
  );
};

export default TeacherMainPage;