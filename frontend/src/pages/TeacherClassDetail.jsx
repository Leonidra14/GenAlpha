import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ImportTopicModal from "../components/ImportTopicModal";
import Modal from "../components/Modal";

import {
  getClassDetail,
  getClassTopics,
  createTopic,
  updateTopic,
  deleteTopic,
} from "../api/api";

import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import ClassFormModal from "../components/ClassFormModal";
import ClassStudentsModal from "../components/ClassStudentsModal";
import { useLogout } from "../hooks/useLogout";

import "./TeacherClassDetail.css";

// decor
import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../constants/backgroundDecorPresets";

function TopicRow({ topic, classId, isInactive, busy, onOpen, onToggle, onDelete }) {
  const navigate = useNavigate();

  return (
    <div
      className={`tcdTopic${isInactive ? " tcdTopicInactive" : ""}${busy ? " tcdTopicBusy" : ""}`}
      onClick={() => !busy && onOpen(topic.id)}
    >
      <div className="tcdTopicLeft">
        <div className="tcdBulb" aria-hidden="true">💡</div>
        <div className="tcdTopicTitle">{topic.title}</div>
      </div>
      <div className="tcdTopicActions" onClick={(e) => e.stopPropagation()}>
        <button
          className="tcdBtn ghost"
          type="button"
          disabled={busy}
          onClick={() => navigate(`/teacher/classes/${classId}/topics/${topic.id}/stats`)}
        >
          Statistiky
        </button>
        <button className="tcdBtn pill" type="button" disabled={busy} onClick={() => onToggle(topic)}>
          {isInactive ? "Aktivovat" : "Deaktivovat"}
        </button>
        <button
          className="tcdBtn pillDanger"
          type="button"
          disabled={busy}
          onClick={() => onDelete(topic)}
        >
          Smazat
        </button>
      </div>
    </div>
  );
}

export default function TeacherClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();

  const [cls, setCls] = useState(null);
  const [topics, setTopics] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [pageError, setPageError] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [topicActionId, setTopicActionId] = useState(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [topicPendingDelete, setTopicPendingDelete] = useState(null);

  function openTopic(topicId) {
    navigate(`/teacher/classes/${classId}/topics/${topicId}`);
  }

  const load = useCallback(async () => {
    setPageError("");
    setMessage({ type: "", text: "" });
    setLoading(true);
    try {
      const [c, t] = await Promise.all([getClassDetail(classId), getClassTopics(classId)]);
      setCls(c);
      setTopics(t || []);
    } catch (e) {
      setPageError(e?.message || "Nepodařilo se načíst třídu.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  async function onAddTopic(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setMessage({ type: "", text: "" });
    setCreateLoading(true);
    try {
      await createTopic(classId, { title: newTitle.trim() });
      setNewTitle("");
      await load();
      setMessage({ type: "success", text: "✅ Kapitola byla vytvořena." });
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Nepodařilo se vytvořit kapitolu." });
    } finally {
      setCreateLoading(false);
    }
  }

  async function onToggleTopic(topic) {
    setMessage({ type: "", text: "" });
    setTopicActionId(topic.id);
    try {
      await updateTopic(classId, topic.id, {
        title: topic.title,
        active: !topic.active,
      });
      await load();
      setMessage({ type: "success", text: `✅ Kapitola „${topic.title}“ byla upravena.` });
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Nepodařilo se změnit stav kapitoly." });
    } finally {
      setTopicActionId(null);
    }
  }

  function requestDeleteTopic(topic) {
    setTopicPendingDelete(topic);
  }

  async function confirmDeleteTopic() {
    const topic = topicPendingDelete;
    if (!topic) return;
    setTopicPendingDelete(null);
    setMessage({ type: "", text: "" });
    setTopicActionId(topic.id);
    try {
      await deleteTopic(classId, topic.id);
      await load();
      setMessage({ type: "success", text: `✅ Kapitola „${topic.title}“ byla smazána.` });
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Nepodařilo se smazat kapitolu." });
    } finally {
      setTopicActionId(null);
    }
  }

  const logout = useLogout();

  const randomDecos = useRandomDecorations({
    ...backgroundDecorPresets.classTopicDetail,
    starSrc: star,
    flightSrc: flight,
  });

  if (loading) {
    return (
      <div className="tcdPage">
        <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
        <div className="tcdWrap">
          <div className="tcdLoading tcdLoading--darkText">Načítám…</div>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="tcdPage">
        <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
        <div className="tcdWrap">
          <div className="tcdError">{pageError}</div>
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

            <div className="tcdHeaderActions">
              <div className="tcdHeaderButtons">
                <button className="tcdBtn primarySoft" onClick={() => setStudentsOpen(true)}>
                  👩‍🎓 Studenti ({cls.num_students ?? 0})
                </button>

                <button className="tcdBtn ghost" onClick={() => setSettingsOpen(true)}>
                  ⚙️ Nastavení
                </button>
              </div>

              <div className="tcdHeaderButtons">
                <button className="tcdBtn ghost" onClick={() => navigate(`/teacher/classes/${classId}/stats`)}>
                  📊 Statistika třídy
                </button>
                <button className="tcdBtn ghost" onClick={() => navigate("/teacher")}>
                  ← Zpět
                </button>
              </div>
            </div>

            {message.text && (
              <div className={message.type === "success" ? "tcdSuccess" : "tcdError"}>
                {message.text}
              </div>
            )}

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
                  disabled={createLoading || topicActionId !== null}
                />
              </div>

              <button className="tcdBtn primary" type="submit" disabled={createLoading || topicActionId !== null}>
                {createLoading ? "Vytvářím..." : "＋ Vytvořit"}
              </button>

              <button
                type="button"
                className="tcdBtn"
                onClick={() => setImportOpen(true)}
                disabled={createLoading || topicActionId !== null}
              >
                ⬆ Nahrát
              </button>
            </form>
          </div>

          <div className="tcdSection">
            <div className="tcdSectionTitle">Aktivní</div>
            {activeTopics.length === 0 && <div className="tcdEmpty">Žádné aktivní kapitoly</div>}
            {activeTopics.map((t) => (
              <TopicRow
                key={t.id}
                topic={t}
                classId={classId}
                isInactive={false}
                busy={createLoading || topicActionId === t.id}
                onOpen={openTopic}
                onToggle={onToggleTopic}
                onDelete={requestDeleteTopic}
              />
            ))}
          </div>

          <div className="tcdSection">
            <div className="tcdSectionTitle muted">Neaktivní</div>
            {inactiveTopics.length === 0 && <div className="tcdEmpty">Žádné neaktivní kapitoly</div>}
            {inactiveTopics.map((t) => (
              <TopicRow
                key={t.id}
                topic={t}
                classId={classId}
                isInactive
                busy={createLoading || topicActionId === t.id}
                onOpen={openTopic}
                onToggle={onToggleTopic}
                onDelete={requestDeleteTopic}
              />
            ))}
          </div>
        </div>

        <ClassFormModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          editingClassId={classId}
          onSuccess={() => load()}
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

        <Modal
          open={topicPendingDelete != null}
          onClose={() => setTopicPendingDelete(null)}
          title="Smazat kapitolu?"
        >
          {topicPendingDelete ? (
            <>
              <p className="tcdConfirmModalBody">
                Opravdu chceš nenávratně smazat kapitolu{" "}
                <strong>„{topicPendingDelete.title}“</strong>?
              </p>
              <div className="gaModalActions">
                <button
                  type="button"
                  className="tcdBtn"
                  onClick={() => setTopicPendingDelete(null)}
                  disabled={topicActionId !== null}
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  className="tcdBtn pillDanger"
                  onClick={() => void confirmDeleteTopic()}
                  disabled={topicActionId !== null}
                >
                  Smazat
                </button>
              </div>
            </>
          ) : null}
        </Modal>
      </div>
    </div>
  );
}