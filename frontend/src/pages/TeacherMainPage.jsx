// src/pages/TeacherMainPage.jsx
import React, { useEffect, useState } from "react";
import TeacherClassCard from "../components/TeacherClassCard";
import { getTeacherClasses } from "../api/api";



const TeacherMainPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
  getTeacherClasses()
    .then((data) => {
      console.log(
        "CLASSES DATA:",
        data,
        "type:",
        typeof data,
        "isArray:",
        Array.isArray(data)
      );

      // 🔒 jistota: do state vždy ukládáme pole
      if (Array.isArray(data)) {
        setClasses(data);
      } else if (Array.isArray(data?.classes)) {
        setClasses(data.classes);
      } else {
        setClasses([]);
        setError("API nevrátilo seznam tříd.");
      }
    })
    .catch((err) => {
      console.error("Chyba při načítání tříd:", err);
      setError(err?.message || "Nepodařilo se načíst třídy.");
      setClasses([]); // 👈 důležité
    });
}, []);


  const logout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/teacher/login";
  };

  return (
    <div className="teacher-dashboard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Tvé třídy</h1>
        <button onClick={logout}>Odhlásit</button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div className="class-grid">
        {Array.isArray(classes) && classes.map((c) => (
          <TeacherClassCard key={c.id ?? c.class_id} classInfo={c} />
        ))}
      </div>
    </div>
  );
};

export default TeacherMainPage;
