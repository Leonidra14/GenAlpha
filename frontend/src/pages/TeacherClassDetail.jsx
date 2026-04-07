import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ImportTopicModal from "../components/ImportTopicModal";

import {
  getClassDetail,
  getClassTopics,
  createTopic,
  updateTopic,
  deleteTopic,
} from "../api/api";

import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import ClassSettingsModal from "../components/ClassSettingsModal";
import ClassStudentsModal from "../components/ClassStudentsModal";
import { useLogout } from "../hooks/useLogout";

import "./TeacherClassDetail.css";

// decor
import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import { useRandomDecorations } from "../hooks/useRandomDecorations";

export default function TeacherClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [cls, setCls] = useState(null);
  const [topics, setTopics] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  function openTopic(topicId) {
    navigate(`/teacher/classes/${classId}/topics/${topicId}`);
  }

  async function load() {
    setError("");
    setLoading(true);
    try {
      const c = await getClassDetail(classId);
      const t = await getClassTopics(classId);
      setCls(c);
      setTopics(t || []);
    } catch (e) {
      setError(e?.message || "Nepodařilo se načíst třídu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [classId]);

  async function onAddTopic(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await createTopic(classId, { title: newTitle.trim() });
      setNewTitle("");
      await load();
    } catch (e) {
      alert(e?.message || "Nepodařilo se vytvořit kapitolu.");
    }
  }

  async function onToggleTopic(topic) {
    try {
      await updateTopic(classId, topic.id, {
        title: topic.title,
        active: !topic.active,
      });
      await load();
    } catch (e) {
      alert(e?.message || "Nepodařilo se změnit stav kapitoly.");
    }
  }

  async function onDeleteTopic(topic) {
    const ok = window.confirm("Opravdu chceš tuto kapitolu smazat?");
    if (!ok) return;

    try {
      await deleteTopic(classId, topic.id);
      await load();
    } catch (e) {
      alert(e?.message || "Nepodařilo se smazat kapitolu.");
    }
  }

  const logout = useLogout();

  const randomDecos = useRandomDecorations({
    seed: 123,
    starSrc: star,
    flightSrc: flight,
  });

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
          <button className="tcdBtn ghost" onClick={() => navigate("/teacher")}>
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

  const activeTopics = topics.filter((t) => t.active);
  const inactiveTopics = topics.filter((t) => !t.active);

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
        {/* TOPBAR */}
        <AppTopbar
          onLogout={logout}
          topbarClassName="tcdTopbar"
          logoClassName="tcdLogo"
          actionsClassName="tcdTopActions"
          logoutButtonClassName="tcdBtn pillDanger"
        />

        {/* header info */}
        <div className="tcdHeader">
          <div className="tcdHeaderLeft">
            <h1 className="tcdTitle">{title}</h1>

            <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button className="tcdBtn primarySoft" onClick={() => setStudentsOpen(true)}>
                    👩‍🎓 Studenti ({cls.num_students ?? 0})
                  </button>

                  <button className="tcdBtn ghost" onClick={() => setSettingsOpen(true)}>
                    ⚙️ Nastavení
                  </button>
                </div>

                <button className="tcdBtn ghost" onClick={() => navigate("/teacher")}>
                  ← Zpět
                </button>
              </div>


            {cls.note && cls.note.trim() && <div className="tcdSubtitle">{cls.note}</div>}

            <div className="tcdMeta">
              <div>Třída: {cls.grade ?? "—"}</div>
              <div>Předmět: {cls.subject}</div>
            </div>
          </div>
        </div>

        {/* card: kapitoly */}
        <div className="tcdCard">
          <div className="tcdCardHeader">
            <div className="tcdCardTitle">Kapitoly</div>

            <form className="tcdAddForm" onSubmit={onAddTopic}>
              <div className="tcdField">
                <input
                  className="tcdInput"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Název nové kapitoly"
                />
              </div>

              <button className="tcdBtn primary" type="submit">
                ＋ Vytvořit
              </button>

              <button
                type="button"
                className="tcdBtn"
                onClick={() => setImportOpen(true)}
              >
                ⬆ Nahrát
              </button>
            </form>
          </div>

          <div className="tcdSection">
            <div className="tcdSectionTitle">Aktivní</div>
            {activeTopics.length === 0 && <div className="tcdEmpty">Žádné aktivní kapitoly</div>}
            {activeTopics.map((t) => (
              <div key={t.id} className="tcdTopic" onClick={() => openTopic(t.id)}>
                <div className="tcdTopicLeft">
                  <div className="tcdBulb" aria-hidden="true">💡</div>
                  <div className="tcdTopicTitle">{t.title}</div>
                </div>
                <div className="tcdTopicActions" onClick={(e) => e.stopPropagation()}>
                  <button className="tcdBtn pill" type="button" onClick={() => onToggleTopic(t)}>
                    Deaktivovat
                  </button>
                  <button
                    className="tcdBtn pillDanger"
                    type="button"
                    onClick={() => onDeleteTopic(t)}
                  >
                    Smazat
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="tcdSection">
            <div className="tcdSectionTitle muted">Neaktivní</div>
            {inactiveTopics.length === 0 && <div className="tcdEmpty">Žádné neaktivní kapitoly</div>}
            {inactiveTopics.map((t) => (
              <div
                key={t.id}
                className="tcdTopic tcdTopicInactive"
                onClick={() => openTopic(t.id)}
              >
                <div className="tcdTopicLeft">
                  <div className="tcdBulb" aria-hidden="true">💡</div>
                  <div className="tcdTopicTitle">{t.title}</div>
                </div>
                <div className="tcdTopicActions" onClick={(e) => e.stopPropagation()}>
                  <button className="tcdBtn pill" type="button" onClick={() => onToggleTopic(t)}>
                    Aktivovat
                  </button>
                  <button
                    className="tcdBtn pillDanger"
                    type="button"
                    onClick={() => onDeleteTopic(t)}
                  >
                    Smazat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ClassSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          classId={classId}
          onSaved={() => load()}
        />

        <ClassStudentsModal
          open={studentsOpen}
          onClose={() => setStudentsOpen(false)}
          classId={classId}
          onChanged={() => load()}
        />

        <ImportTopicModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          targetClassId={classId}
          onImported={load}
        />
      </div>
    </div>
  );
}