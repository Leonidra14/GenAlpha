import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherClassCard from "../components/TeacherClassCard";
import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import { getStudentClasses } from "../api/api";
import "./TeacherMainPage.css"; 

// dekorace
import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import { useLogout } from "../hooks/useLogout";
import { useRandomDecorations } from "../hooks/useRandomDecorations";


const StudentMainPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");

  const nav = useNavigate();
  const handleLogout = useLogout();

  const randomDecos = useRandomDecorations({
    seed: 99,
    starsMin: 50,
    starsRange: 1,
    flightsMin: 10,
    flightsRange: 1,
    starSrc: star,
    flightSrc: flight,
  });

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
    <div className="tmainPage">
      <AppBackgroundDecor
        cloudsSrc={clouds}
        labsSrc={labs}
        randomDecos={randomDecos}
        cloudsClassName="tmainDec tmainClouds"
        labsClassName="tmainDec tmainLabs"
        randomBaseClassName="tmainDec tmainRand"
        randomFlightClassName="tmainRandFlight"
        randomStarClassName="tmainRandStar"
      />

      <div className="tmainWrap">
        {/* header */}
        <AppTopbar
          onLogout={handleLogout}
          topbarClassName="tmainTopbar"
          logoClassName="tmainLogo"
          actionsClassName="tmainTopActions"
          logoutButtonClassName="tmainLogout tcdBtn"
        />

        <div className="tmainHeader">
          <h1 className="tmainPageTitle">Tvé třídy</h1>
        </div>

        {error && <div className="tmainError">{error}</div>}

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
          <div className="tmainError" style={{ background: "transparent" }}>
            Zatím nemáš žádné aktivní třídy.
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentMainPage;
