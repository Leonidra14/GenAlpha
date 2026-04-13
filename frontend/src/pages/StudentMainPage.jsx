import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherClassCard from "../components/TeacherClassCard";
import ClassListPageLayout from "../components/layout/ClassListPageLayout";
import { getStudentClasses } from "../api/api";
import "./MainPage.css"; 
import { useLogout } from "../hooks/useLogout";


const StudentMainPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");

  const nav = useNavigate();
  const handleLogout = useLogout();

  async function load() {
    setError("");
    try {
      const data = await getStudentClasses();
      const arr = Array.isArray(data) ? data : [];
      setClasses(arr.filter((c) => c.active));
    } catch (err) {
      console.error("Chyba při načítání tříd:", err);
      setError(err?.message || "Nepodařilo se načíst třídy.");
      setClasses([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <ClassListPageLayout onLogout={handleLogout} title="Tvé třídy" error={error}>
        <h2 className="tmainSectionTitle">Aktivní</h2>
        <div className="tmainGrid">
          {classes.map((c) => (
            <TeacherClassCard
              key={c.id}
              classInfo={c}
              onOpen={() => nav(`/student/classes/${c.id}`)}
            />
          ))}
        </div>

        {classes.length === 0 && !error && (
          <div className="tmainError tmainEmptyState">
            Zatím nemáš žádné aktivní třídy.
          </div>
        )}
    </ClassListPageLayout>
  );
};

export default StudentMainPage;
