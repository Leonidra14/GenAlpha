import React, { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import "./TeacherLogin.css";

import logo from "../assets/logo.png";
import teacherIllustration from "../assets/teacher2.png";
import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function TeacherRegister() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();

  // ⭐✈️ random dekorace (STEJNÉ jako login)
  const randomDecos = useMemo(() => {
    const rand = mulberry32(77);
    const starsCount = 16 + Math.floor(rand() * 10);
    const flightsCount = 6 + Math.floor(rand() * 5);
    const items = [];

    const add = (count, type) => {
      for (let i = 0; i < count; i++) {
        items.push({
          id: `${type}-${i}`,
          type,
          src: type === "star" ? star : flight,
          style: {
            left: `${Math.round(rand() * 100)}%`,
            top: `${Math.round(rand() * 85)}%`,
            opacity: 0.18 + rand() * 0.35,
            transform: `translate(-50%, -50%) scale(${0.6 + rand()}) rotate(${rand() * 30 - 15}deg)`,
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
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          password,
        }),
      });

      localStorage.setItem("access_token", data.access_token);
      nav("/teacher");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Registrace se nepovedla.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tloginPage">
      {/* pozadí */}
      <img className="tloginDec tloginClouds" src={clouds} alt="" />

      {randomDecos.map((d) => (
        <img
          key={d.id}
          className={`tloginDec tloginRand ${
            d.type === "flight" ? "tloginRandFlight" : "tloginRandStar"
          }`}
          src={d.src}
          style={d.style}
          alt=""
        />
      ))}

      <img className="tloginDec tloginLabs" src={labs} alt="" />

      <div className="tloginWrap">
        <div className="tloginHeader">
          <img className="tloginLogo" src={logo} alt="GenAlpha" />
        </div>

        <div className="tloginCard">
          <h1 className="tloginTitle">Registrace učitele</h1>

          {/* učitel nalepený na kartě */}
          <img
            className="tloginTeacher"
            src={teacherIllustration}
            alt=""
            aria-hidden="true"
          />

          <form className="tloginForm" onSubmit={onSubmit}>
            <label className="tloginField">
              <span className="tloginIcon">👤</span>
              <input
                className="tloginInput"
                placeholder="Jméno"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={loading}
                maxLength={80}
              />
            </label>

            <label className="tloginField">
              <span className="tloginIcon">👤</span>
              <input
                className="tloginInput"
                placeholder="Příjmení"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={loading}
                maxLength={80}
              />
            </label>

            <label className="tloginField">
              <span className="tloginIcon">✉️</span>
              <input
                className="tloginInput"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                maxLength={255}
                type="email"
              />
            </label>

            <label className="tloginField">
              <span className="tloginIcon">🔒</span>
              <input
                className="tloginInput"
                type="password"
                placeholder="Heslo (8–72 znaků)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
                maxLength={72}
              />
            </label>

            <button className="tloginBtn" type="submit" disabled={loading}>
              {loading ? "Registruji..." : "Registrovat"}
            </button>

            <div className="tloginLinks">
              <span>Už máš účet?</span>{" "}
              <Link to="/teacher/login" className="tloginLink">
                Přihlásit se
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
