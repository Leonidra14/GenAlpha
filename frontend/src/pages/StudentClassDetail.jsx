import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getStudentClassDetail,
  getStudentClassTopics,
  setStudentTopicDone,
} from "../api/api";
import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import { useLogout } from "../hooks/useLogout";

import "./TeacherClassDetail.css";

// decor
import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../constants/backgroundDecorPresets";

export default function StudentClassDetail() {
  const { classId } = useParams();
  const nav = useNavigate();

  const [cls, setCls] = useState(null);
  const [topics, setTopics] = useState([]);
  const [error, setError] = useState("");
  const [progressError, setProgressError] = useState("");
  const [loading, setLoading] = useState(true);

  const logout = useLogout();

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
  }, [classId]);

  async function markDone(topic, doneValue) {
    setProgressError("");
    setTopics((prev) =>
      prev.map((x) => (x.id === topic.id ? { ...x, done: doneValue } : x))
    );

    try {
      await setStudentTopicDone(topic.id, doneValue);
    } catch (e) {
      setTopics((prev) =>
        prev.map((x) => (x.id === topic.id ? { ...x, done: !doneValue } : x))
      );
      setProgressError(e?.message || "Nepodařilo se uložit stav.");
    }
  }

  const randomDecos = useRandomDecorations({
    ...backgroundDecorPresets.classTopicDetail,
    starSrc: star,
    flightSrc: flight,
  });

  function openTopic(topicId) {
    nav(`/student/classes/${classId}/topics/${topicId}`);
  }

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

  const notDoneTopics = topics.filter((t) => !t.done);
  const doneTopics = topics.filter((t) => t.done);

  return (
    <div className="tcdPage">
      <AppBackgroundDecor
        cloudsSrc={clouds}
        labsSrc={labs}
        randomDecos={randomDecos}
        cloudsClassName="tcdDec tcdClouds"
        labsClassName="tcdDec tcdLabs"
        randomBaseClassName="tcdDec tcdRand"
        randomFlightClassName="tcdRandFlight"
        randomStarClassName="tcdRandStar"
      />

      <div className="tcdWrap">
        {/* topbar */}
        <AppTopbar
          onLogout={logout}
          topbarClassName="tcdTopbar"
          logoClassName="tcdLogo"
          actionsClassName="tcdTopActions"
          logoutButtonClassName="tcdBtn pillDanger"
          actions={
            <button className="tcdBtn ghost" onClick={() => nav("/student")}>
              ← Zpět
            </button>
          }
        />

        {/* header info */}
        <div className="tcdHeader">
          <h1 className="tcdTitle">{title}</h1>

          {progressError && <div className="tcdError">{progressError}</div>}

          {cls.note && cls.note.trim() && <div className="tcdSubtitle">{cls.note}</div>}

          <div className="tcdMeta">
            <div>Učitel: {teacherName}</div>
            <div>Předmět: {cls.subject}</div>
            <div>Třída: {cls.grade ?? "—"}</div>
          </div>
        </div>

        {/* Chapters */}
        <div className="tcdCard">
          <div className="tcdCardHeader">
            <div className="tcdCardTitle">Kapitoly</div>
          </div>

          {/* Not done yet */}
          <div className="tcdSection">
            <div className="tcdSectionTitle">Ještě ne</div>

            {notDoneTopics.length === 0 && (
              <div className="tcdEmpty">Všechny kapitoly máš hotové 🎉</div>
            )}

            {notDoneTopics.map((t) => (
              <div key={t.id} className="tcdTopic" onClick={() => openTopic(t.id)}>
                <div className="tcdTopicLeft">
                  <div className="tcdBulb" aria-hidden="true">
                    💡
                  </div>
                  <div className="tcdTopicTitle">{t.title}</div>
                </div>

                <div className="tcdTopicActions" onClick={(e) => e.stopPropagation()}>
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

          {/* Done */}
          <div className="tcdSection">
            <div className="tcdSectionTitle muted">Hotovo</div>

            {doneTopics.length === 0 && (
              <div className="tcdEmpty">Zatím nemáš nic hotové</div>
            )}

            {doneTopics.map((t) => (
              <div key={t.id} className="tcdTopic tcdTopicInactive" onClick={() => openTopic(t.id)}>
                <div className="tcdTopicLeft">
                  <div className="tcdBulb" aria-hidden="true">
                    💡
                  </div>
                  <div className="tcdTopicTitle">{t.title}</div>
                </div>

                <div className="tcdTopicActions" onClick={(e) => e.stopPropagation()}>
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
