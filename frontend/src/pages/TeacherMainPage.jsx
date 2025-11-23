import React, { useEffect, useState } from 'react';
import TeacherClassCard from '../components/TeacherClassCard';
import './TeacherMainPage.css'; // můžeš vytvořit vlastní styl

const TeacherMainPage = () => {
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    fetch('/api/classes') // uprav podle backendu
      .then(res => res.json())
      .then(data => setClasses(data))
      .catch(err => console.error('Chyba při načítání tříd:', err));
  }, []);

  return (
    <div className="teacher-dashboard">
      <h1>Tvé Třídy</h1>
      <div className="class-grid">
        {classes.map(c => (
          <TeacherClassCard key={c.id} classInfo={c} />
        ))}
      </div>
    </div>
  );
};

export default TeacherMainPage;
