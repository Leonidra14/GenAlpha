// src/pages/TeacherMainPage.jsx
import React, { useEffect, useState } from "react";
import TeacherClassCard from "../components/TeacherClassCard";
import { getTeacherClasses } from "../api/api";

const TeacherMainPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getTeacherClasses()
      .then((data) => setClasses(data))
      .catch((err) => {
        console.error("Chyba při načítání tříd:", err);
        setError("Nepodařilo se načíst třídy.");
      });
  }, []);

  return (
    <div className="teacher-dashboard">
      <h1>Tvé třídy</h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div className="class-grid">
        {classes.map((c) => (
          <TeacherClassCard key={c.class_id} classInfo={c} />
        ))}
      </div>
    </div>
  );
};

export default TeacherMainPage;
