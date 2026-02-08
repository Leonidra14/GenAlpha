import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getStudentClassDetail,
  getStudentClassTopics,
  setStudentTopicDone,
} from "../api/api";

import "./TeacherClassDetail.css";

// decor
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

export default function StudentClassDetail() {
  const { classId } = useParams();
  const nav = useNavigate();

  const [cls, setCls] = useState(null);
  const [topics, setTopics] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem("access_token");
    window.location.href = "/";
  };

  async function load() {
    setError("");
    setLoading(true);
    try {
      const c = await getStudentClassDetail(classId);
      const t = await getStudentClassTopics(classId);
      setCls(c);
      setTopics(Array.isArray(t) ? t : []);
    } catch (e) {
      setError(e?.message || "Nepodařilo se načíst třídu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function markDone(topic, doneValue) {
    // optimistický update v UI
    setTopics((prev) =>
      prev.map((x) => (x.id === topic.id ? { ...x, done: doneValue } : x))
    );

    try {
      await setStudentTopicDone(topic.id, doneValue);
    } catch (e) {
      // revert
      setTopics((prev) =>
        prev.map((x) => (x.id === topic.id ? { ...x, done: !doneValue } : x))
      );
      alert(e?.message || "Nepodařilo se uložit stav.");
    }
  }

  /* ⭐✈️ random dekorace */
  const randomDecos = useMemo(() => {
    const rand = mulberry32(123);

    const starsCount = 18 + Math.floor(rand() * 10);
    const flightsCount = 6 + Math.floor(rand() * 4);

    const items = [];
    const add = (count, type) => {
      for (let i = 0; i < count; i++) {
        const left = `${Math.round(rand() * 100)}%`;
        const top = `${Math.round(rand() * 85)}%`;

        const scale = type === "star" ? 0.6 + rand() * 0.9 : 0.75 + rand() * 0.7;
        const rotate = (rand() * 30 - 15).toFixed(1);
        const opacity = (0.18 + rand() * 0.32).toFixed(2);

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

  if (loading) {
    return (
      <div className="tcdPage">
        <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
        <div className="tcdWrap">
          <div className="tcdLoading">Načítám…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tcdPage">
        <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
        <div className="tcdWrap">
          <div className="tcdError">{error}</div>
          <button className="tcdBtn ghost" onClick={() => nav("/student")}>
            ← Zpět
          </button>
        </div>
      </div>
    );
  }

  if (!cls) return null;

  const title =
    cls.custom_name && cls.custom_name.trim()
      ? cls.custom_name
      : cls.grade != null
      ? `${cls.grade}. třída – ${cls.subject}`
      : `Třída – ${cls.subject}`;

  const teacherName =
    [cls.teacher_first_name, cls.teacher_last_name].filter(Boolean).join(" ") || "—";

  // ✅ rozdělení jako "Aktivní/Neaktivní" u učitele, ale podle progress
  const notDoneTopics = topics.filter((t) => !t.done);
  const doneTopics = topics.filter((t) => t.done);

  return (
    <div className="tcdPage">
      {/* decor */}
      <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
      {randomDecos.map((d) => (
        <img
          key={d.id}
          className={`tcdDec tcdRand ${d.type === "flight" ? "tcdRandFlight" : "tcdRandStar"}`}
          src={d.src}
          alt=""
          aria-hidden="true"
          style={d.style}
        />
      ))}
      <img className="tcdDec tcdLabs" src={labs} alt="" aria-hidden="true" />

      <div className="tcdWrap">
        {/* topbar */}
        <div className="tcdTopbar">
          <img className="tcdLogo" src={logo} alt="GenAlpha" />
          <div className="tcdTopActions">
            <button className="tcdBtn ghost" onClick={() => nav("/student")}>
              ← Zpět
            </button>
            <button className="tcdBtn pillDanger" onClick={logout}>
              ⟶ Odhlásit se
            </button>
          </div>
        </div>

        {/* header info */}
        <div className="tcdHeader">
          <h1 className="tcdTitle">{title}</h1>

          {cls.note && cls.note.trim() && <div className="tcdSubtitle">{cls.note}</div>}

          <div className="tcdMeta">
            <div>Učitel: {teacherName}</div>
            <div>Předmět: {cls.subject}</div>
            <div>Třída: {cls.grade ?? "—"}</div>
          </div>
        </div>

        {/* card: kapitoly */}
        <div className="tcdCard">
          <div className="tcdCardHeader">
            <div className="tcdCardTitle">Kapitoly</div>
          </div>

          {/* Ještě ne (jako "Aktivní") */}
          <div className="tcdSection">
            <div className="tcdSectionTitle">Ještě ne</div>

            {notDoneTopics.length === 0 && (
              <div className="tcdEmpty">Všechny kapitoly máš hotové 🎉</div>
            )}

            {notDoneTopics.map((t) => (
              <div key={t.id} className="tcdTopic">
                <div className="tcdTopicLeft">
                  <div className="tcdBulb" aria-hidden="true">
                    💡
                  </div>
                  <div className="tcdTopicTitle">{t.title}</div>
                </div>

                <div className="tcdTopicActions">
                  <button
                    type="button"
                    className="tcdBtn pill"
                    onClick={() => markDone(t, true)}
                  >
                    ✅ Označit hotovo
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Hotovo (jako "Neaktivní") */}
          <div className="tcdSection">
            <div className="tcdSectionTitle muted">Hotovo</div>

            {doneTopics.length === 0 && (
              <div className="tcdEmpty">Zatím nemáš nic hotové</div>
            )}

            {doneTopics.map((t) => (
              <div key={t.id} className="tcdTopic tcdTopicInactive">
                <div className="tcdTopicLeft">
                  <div className="tcdBulb" aria-hidden="true">
                    💡
                  </div>
                  <div className="tcdTopicTitle">{t.title}</div>
                </div>

                <div className="tcdTopicActions">
                  <button
                    type="button"
                    className="tcdBtn pillDanger"
                    onClick={() => markDone(t, false)}
                  >
                    ⬜ Vrátit na „Ještě ne“
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
