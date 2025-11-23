// src/components/TeacherClassCard.jsx
import React from "react";

const TeacherClassCard = ({ classInfo }) => (
  <div className="class-card">
    <h2>{classInfo.name}</h2>
    <p>Počet studentů: {classInfo.num_students}</p>
    <p>
      Poslední úkol:{" "}
      {classInfo.last_assignment ? classInfo.last_assignment : "Žádný"}
    </p>
  </div>
);

export default TeacherClassCard;
