import React from 'react';
import './TeacherClassCard.css';

const TeacherClassCard = ({ classInfo }) => (
  <div className="class-card">
    <h2>{classInfo.name}</h2>
    <p>Ročník: {classInfo.grade}</p>
    <p>Předmět: {classInfo.subject}</p>
  </div>
);

export default TeacherClassCard;
