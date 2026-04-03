import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ImportTopicModal from "../components/ImportTopicModal";

import {
  getClassDetail,
  getClassTopics,
  createTopic,
  updateTopic,
  deleteTopic,
} from "../api/api";

import { apiFetch } from "../api/client"; // ⭐ PŘIDÁNO: importujeme tvůj bezpečný fetcher
import ClassSettingsModal from "../components/ClassSettingsModal";
import ClassStudentsModal from "../components/ClassStudentsModal";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ⭐ UPRAVENO: Funkce pro kompletní odhlášení (stejná logika jako na minulé stránce)
  const logout = async () => {
    try {
      // 1. Zneplatníme session v DB a smažeme cookie
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Chyba při logoutu na serveru:", err);
    } finally {
      // 2. Vždy vyčistíme lokální paměť a pošleme uživatele na začátek
      localStorage.removeItem("access_token");
      window.location.href = "/";
    }
  };

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
        {/* TOPBAR */}
        <div className="tcdTopbar">
          <img className="tcdLogo" src={logo} alt="GenAlpha" />
          <div className="tcdTopActions">
            {/* Tlačítko nyní volá naši asynchronní funkci logout */}
            <button className="tcdBtn pillDanger" onClick={logout}>
              ⟶ Odhlásit se
            </button>
          </div>
        </div>

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