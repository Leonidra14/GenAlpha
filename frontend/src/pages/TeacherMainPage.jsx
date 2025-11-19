import React, { useEffect, useState } from "react";
import { fetchTeacherData } from "../api/teacherApi";
import TeacherClassCard from "../components/TeacherClassCard";

const TeacherDashboard = () => {
  const [teacher, setTeacher] = useState(null);
  const teacherId = "teacher123"; // budeš brát z loginu/session později

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchTeacherData(teacherId);
      setTeacher(data);
    };
    loadData();
  }, []);

  if (!teacher) return <p>Načítám…</p>;

  return (
    <div className="dashboard">
      <h1>Vítej, {teacher.name}</h1>
      <h2>Tvoje třídy</h2>
      <div className="class-list">
        {teacher.classes.map((cls) => (
          <TeacherClassCard
            key={cls.id}
            className={cls.name}
            subjectCount={cls.topics.length}
            onClick={() => console.log("Kliknuto na", cls.name)}
          />
        ))}
      </div>
    </div>
  );
};

export default TeacherDashboard;
