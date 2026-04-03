import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TeacherClassCard from "../components/TeacherClassCard";
import CreateClassModal from "../components/CreateClassModal";
import { getTeacherClasses, updateClass } from "../api/api";
import { apiFetch } from "../api/client"; // ⭐ PŘIDÁNO: importujeme tvůj upravený fetcher
import "./TeacherMainPage.css";

// dekorace (zůstávají stejné)
import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import logo from "../assets/logo.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";

/* deterministic random (zůstává stejné) */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TeacherMainPage = () => {
  const [classes, setClasses] = useState([]);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const nav = useNavigate();

  // ⭐ PŘIDÁNO: Funkce pro opravdové odhlášení
  const handleLogout = async () => {
    try {
      // 1. Zavoláme backend, aby smazal Refresh Token z DB a smazal Cookie
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (err) {
      // Pokud server neodpovídá, aspoň zalogujeme chybu, ale uživatele odhlásíme lokálně
      console.warn("Serverové odhlášení selhalo, pokračuji lokálně.", err);
    } finally {
      // 2. V každém případě smažeme Access Token z paměti prohlížeče
      localStorage.removeItem("access_token");
      // 3. Pošleme uživatele na úvodní stránku
      nav("/");
    }
  };

  /* ⭐✈️ random dekorace (zůstává stejné) */
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
        <div className="tmainTopbar">
          <img className="tmainLogo" src={logo} alt="GenAlpha" />
          <h1 className="tmainTitle tmainTitleInline">Tvé třídy</h1>
          
          {/* ⭐ UPRAVENO: Tlačítko nyní volá naši novou funkci handleLogout */}
          <button className="tmainLogout" onClick={handleLogout}>
            ⟶ Odhlásit se
          </button>
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