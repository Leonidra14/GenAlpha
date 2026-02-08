import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherClassCard from "../components/TeacherClassCard";
import { getStudentClasses } from "../api/api";
import "./TeacherMainPage.css"; 

// dekorace
import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import logo from "../assets/logo.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";

/* deterministic random */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const StudentMainPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");

  const nav = useNavigate();

  /* ⭐✈️ random dekorace */
  const randomDecos = useMemo(() => {
    const rand = mulberry32(99);

    const starsCount = 50;
    const flightsCount = 10;

    const items = [];
    const add = (count, type) => {
      for (let i = 0; i < count; i++) {
        const left = `${Math.round(rand() * 100)}%`;
        const top = `${Math.round(rand() * 85)}%`;

        const scale = type === "star" ? 0.6 + rand() * 0.9 : 0.75 + rand() * 0.7;
        const rotate = (rand() * 30 - 15).toFixed(1);
        const opacity = (0.18 + rand() * 0.35).toFixed(2);

        items.push({
          id: `${type}-${i}`,
          type,
          src: type === "star" ? star : flight,
          style: {
            left,
            top,
            opacity,
            transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
          },
        });
      }
    };

    add(starsCount, "star");
    add(flightsCount, "flight");
    return items;
  }, []);

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
      {/* dekorace pozadí */}
      <img className="tmainDec tmainClouds" src={clouds} alt="" aria-hidden="true" />

      {randomDecos.map((d) => (
        <img
          key={d.id}
          className={`tmainDec tmainRand ${d.type === "flight" ? "tmainRandFlight" : "tmainRandStar"}`}
          src={d.src}
          alt=""
          aria-hidden="true"
          style={d.style}
        />
      ))}

      <img className="tmainDec tmainLabs" src={labs} alt="" aria-hidden="true" />

      <div className="tmainWrap">
        {/* header */}
        <div className="tmainTopbar">
          <img className="tmainLogo" src={logo} alt="GenAlpha" />
          <h1 className="tmainTitle tmainTitleInline">Tvé třídy</h1>
          <button className="tmainLogout" onClick={() => nav("/")}>
            ⟶ Odhlásit se
          </button>
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
