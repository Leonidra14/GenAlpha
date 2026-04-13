import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/client";
import AppBackgroundDecor from "../layout/AppBackgroundDecor";
import { useRandomDecorations } from "../../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../../constants/backgroundDecorPresets";
import "./AuthLoginPage.css";

import logo from "../../assets/logo.png";
import clouds from "../../assets/clouds.png";
import labs from "../../assets/lab_books.png";
import star from "../../assets/star.png";
import flight from "../../assets/flight.png";

export default function AuthLoginPage({
  title,
  navigateTo,
  illustrationSrc,
  illustrationClassName = "tloginTeacher",
  showRegister = false,
  registerPath = "/teacher/register",
  loginPlaceholder = "E-mail nebo přihlašovací jméno",
  loginAutoComplete = "username",
}) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const randomDecos = useRandomDecorations({
    ...backgroundDecorPresets.auth,
    starSrc: star,
    flightSrc: flight,
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ login: login.trim(), password }),
      });
      localStorage.setItem("access_token", data.access_token);
      nav(navigateTo);
    } catch (err) {
      const msg = err?.message?.toLowerCase() || "";
      if (msg.includes("invalid") || msg.includes("credential") || msg.includes("neplatné")) {
        setError("Chybné přihlašovací jméno nebo heslo.");
      } else {
        setError(err?.message || "Přihlášení se nepovedlo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tloginPage">
      <AppBackgroundDecor
        cloudsSrc={clouds}
        labsSrc={labs}
        randomDecos={randomDecos}
        cloudsClassName="tloginDec tloginClouds"
        labsClassName="tloginDec tloginLabs"
        randomBaseClassName="tloginDec tloginRand"
        randomFlightClassName="tloginRandFlight"
        randomStarClassName="tloginRandStar"
      />

      <div className="tloginWrap">
        <div className="tloginHeader">
          <img className="tloginLogo" src={logo} alt="GenAlpha" />
        </div>

        <div className="tloginCard">
          <h1 className="tloginTitle">{title}</h1>
          <img className={illustrationClassName} src={illustrationSrc} alt="" aria-hidden="true" />

          <form className="tloginForm" onSubmit={onSubmit}>
            <label className="tloginField">
              <span className="tloginIcon" aria-hidden="true">✉️</span>
              <input
                className="tloginInput"
                placeholder={loginPlaceholder}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                disabled={loading}
                autoComplete={loginAutoComplete}
              />
            </label>

            <label className="tloginField">
              <span className="tloginIcon" aria-hidden="true">🔒</span>
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

            {showRegister && (
              <div className="tloginLinks">
                <span>Nemáš účet?</span>{" "}
                <Link to={registerPath} className="tloginLink">Zaregistrovat se</Link>
              </div>
            )}

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
