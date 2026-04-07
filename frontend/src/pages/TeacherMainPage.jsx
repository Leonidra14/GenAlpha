import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherClassCard from "../components/TeacherClassCard";
import CreateClassModal from "../components/CreateClassModal";
import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import { getTeacherClasses, updateClass } from "../api/api";
import "./TeacherMainPage.css";

import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { useLogout } from "../hooks/useLogout";

const TeacherMainPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

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

        <CreateClassModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => load()}
        />
      </div>
    </div>
  );
};

export default TeacherMainPage;