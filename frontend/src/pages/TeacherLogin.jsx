import React, { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import "./TeacherLogin.css";

// assets – uprav názvy/cesty podle sebe
import logo from "../assets/logo.png";
import teacherIllustration from "../assets/teacher2.png";
import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";

// deterministic random (aby to neskákalo po každém renderu)
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function TeacherLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();

  const randomDecos = useMemo(() => {
    const rand = mulberry32(77);

    const starsCount = 50
    const flightsCount = 5

    const items = [];

    const add = (count, type) => {
      for (let i = 0; i < count; i++) {
        const left = `${Math.round(rand() * 100)}%`;
        const top = `${Math.round(rand() * 85)}%`;

        const scale = type === "star"
          ? 0.6 + rand() * 0.9
          : 0.75 + rand() * 0.7;

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

const onSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    localStorage.setItem("access_token", data.access_token);
    nav("/teacher");
  } catch (err) {
    console.error(err);

    const msg = err?.message?.toLowerCase() || "";

    if (msg.includes("invalid") || msg.includes("credential")) {
      setError("Chybně zadaný email nebo heslo.");
    } else {
      setError(err?.message || "Přihlášení se nepovedlo.");
    }
  } finally {
    setLoading(false); // ✅ tohle ti chybělo
  }
};

  return (
    <div className="tloginPage">
      {/* dekorace pozadí */}
      <img
        className="tloginDec tloginClouds"
        src={clouds}
        alt=""
        aria-hidden="true"
      />

      {/* random hvězdy/letadla */}
      {randomDecos.map((d) => (
        <img
          key={d.id}
          className={`tloginDec tloginRand ${d.type === "flight" ? "tloginRandFlight" : "tloginRandStar"}`}
          src={d.src}
          alt=""
          aria-hidden="true"
          style={d.style}
        />
      ))}

      <img
        className="tloginDec tloginLabs"
        src={labs}
        alt=""
        aria-hidden="true"
      />

      <div className="tloginWrap">
        <div className="tloginHeader">
          <img className="tloginLogo" src={logo} alt="GenAlpha" />
        </div>

        <div className="tloginCard">
          <h1 className="tloginTitle">Přihlášení učitele</h1>

          {/* 👇 učitel nalepený na kartě */}
          <img
            className="tloginTeacher"
            src={teacherIllustration}
            alt=""
            aria-hidden="true"
          />

          <form className="tloginForm" onSubmit={onSubmit}>
            <label className="tloginField">
              <span className="tloginIcon" aria-hidden="true">
                ✉️
              </span>
              <input
                className="tloginInput"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </label>

            <label className="tloginField">
              <span className="tloginIcon" aria-hidden="true">
                🔒
              </span>
              <input
                className="tloginInput"
                type="password"
                placeholder="Heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </label>

            <button className="tloginBtn" type="submit" disabled={loading}>
              {loading ? "Přihlašuji..." : "Přihlásit"}
            </button>

            <div className="tloginLinks">
              <span>Nemáš účet?</span>{" "}
              <Link to="/teacher/register" className="tloginLink">
                Zaregistrovat se
              </Link>
            </div>

            <button
              type="button"
              className="tloginBack"
              onClick={() => nav("/")}
              disabled={loading}
            >
              ← Zpět na hlavní stránku
            </button>

            {error && <div className="tloginError">{error}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}
