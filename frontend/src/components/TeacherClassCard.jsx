// src/components/TeacherClassCard.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const TeacherClassCard = ({ classInfo }) => {
  const nav = useNavigate();

  const header =
    classInfo.grade != null
      ? `${classInfo.grade}. třída – ${classInfo.subject}`
      : `Třída – ${classInfo.subject}`;

  return (
    <div
      className="class-card"
      role="button"
      style={{ cursor: "pointer" }}
      onClick={() => nav(`/teacher/classes/${classInfo.id}`)}
    >
      <h2>{header}</h2>
    </div>
  );
};

export default TeacherClassCard;
