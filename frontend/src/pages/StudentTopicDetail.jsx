import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getStudentClassDetail,
  getStudentTopicDetail,
  getStudentTopicMainQuizLeaderboard,
  listStudentQuizAttempts,
} from "../api/api";
import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import { useLogout } from "../hooks/useLogout";
import { normalizeMd } from "../utils/markdown";

import "./TeacherClassDetail.css";

import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import studyRobot from "../assets/study.png";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../constants/backgroundDecorPresets";

function formatDurationSec(durationSec) {
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec < 0) return "—";
  const secTotal = Math.round(durationSec);
  if (secTotal < 60) return `${secTotal} s`;
  const m = Math.floor(secTotal / 60);
  const s = secTotal % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

function formatFinishedAtCs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" });
}

function formatScore(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const rounded = Math.round(x * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  const s = rounded.toFixed(2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return s;
}

/** Jednoduchá medaile (zlato / stříbro / bronz) jako SVG. */
function PodiumMedal({ place }) {
  const palette =
    place === 1
      ? { ribbon: "#b8860b", disk: "#ffd95a", edge: "#a57000" }
      : place === 2
        ? { ribbon: "#7a8494", disk: "#eef1f7", edge: "#5c6575" }
        : { ribbon: "#6b4423", disk: "#c98a4a", edge: "#4a2c12" };

  return (
    <svg
      className="stdLbMedalSvg"
      viewBox="0 0 44 52"
      width="44"
      height="52"
      aria-hidden="true"
    >
      <path d="M6 6 L18 6 L22 20 L26 6 L38 6 L32 22 L22 28 L12 22 Z" fill={palette.ribbon} />
      <circle cx="22" cy="34" r="14" fill={palette.disk} stroke={palette.edge} strokeWidth="1.5" />
      <text
        x="22"
        y="38"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fill={palette.edge}
      >
        {place}
      </text>
    </svg>
  );
}

export default function StudentTopicDetail() {
  const { classId, topicId } = useParams();
  const nav = useNavigate();
  const logout = useLogout();

  const [topic, setTopic] = useState(null);
  const [classDetail, setClassDetail] = useState(null);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [leaderboard, setLeaderboard] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      setLoading(true);
      try {
        const [topicData, classData, attemptsData, lbData] = await Promise.all([
          getStudentTopicDetail(classId, topicId),
          getStudentClassDetail(classId),
          listStudentQuizAttempts(classId, topicId).catch(() => []),
          getStudentTopicMainQuizLeaderboard(classId, topicId).catch(() => null),
        ]);
        if (!cancelled) {
          setTopic(topicData || null);
          setClassDetail(classData || null);
          setQuizAttempts(Array.isArray(attemptsData) ? attemptsData : []);
          setLeaderboard(lbData && typeof lbData === "object" ? lbData : null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Nepodařilo se načíst detail kapitoly.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [classId, topicId]);

  const randomDecos = useRandomDecorations({
    ...backgroundDecorPresets.classTopicDetail,
    starSrc: star,
    flightSrc: flight,
  });

  const mainQuizAttempts = useMemo(
    () => quizAttempts.filter((a) => String(a.attempt_kind || "main").toLowerCase() === "main"),
    [quizAttempts],
  );

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
          <button className="tcdBtn ghost" onClick={() => nav(`/student/classes/${classId}`)}>
            ← Zpět na kapitoly
          </button>
        </div>
      </div>
    );
  }

  const topicTitle = (topic?.title || "").trim() || `Kapitola ${topicId}`;
  const subjectTitle = (classDetail?.subject || "").trim() || `Třída ${classId}`;
  const title = `${subjectTitle} – ${topicTitle}`;
  const notes = normalizeMd(topic?.student_notes_md || "");

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
        <AppTopbar
          onLogout={logout}
          topbarClassName="tcdTopbar"
          logoClassName="tcdLogo"
          actionsClassName="tcdTopActions"
          logoutButtonClassName="tcdBtn pillDanger"
          actions={
            <button className="tcdBtn ghost" onClick={() => nav(`/student/classes/${classId}`)}>
              ← Zpět
            </button>
          }
        />

        <div className="tcdHeader">
          <h1 className="tcdTitle">{title}</h1>
        </div>

        <div className="stdTopicLayout">
          <div className="tcdCard">
            {notes ? (
              <div className="mdBody stdTopicNotesBody">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
              </div>
            ) : (
              <div className="tcdEmpty">Pro tuto kapitolu zatím nejsou dostupné studentské poznámky.</div>
            )}
          </div>

          <div className="stdTopicRightCol">
            <div className="tcdCard stdTopicQuizCard">
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Testový kvíz</div>
              </div>
              <div className="stdTopicQuizColumns">
                <div className="stdTopicQuizCardMain">
                  <p className="tcdEmpty stdTopicHint stdTopicQuizIntroText">Hlavní testovací kvíz</p>
                  <div className="tcdCardHeader stdTopicQuizHeader">
                    <button
                      type="button"
                      className="tcdBtn primary"
                      onClick={() => nav(`/student/classes/${classId}/topics/${topicId}/quiz`)}
                      disabled={!topic?.quiz_available}
                      title={topic?.quiz_available ? "" : "Kvíz zatím není dostupný."}
                    >
                      Začít kvíz
                    </button>
                  </div>
                  {!topic?.quiz_available && (
                    <div className="tcdEmpty stdTopicHint">
                      Kvíz pro tuto kapitolu zatím není dostupný.
                    </div>
                  )}
                  <p className="tcdEmpty stdTopicHint stdTopicHint--beforeBtn">
                    Další procvičování
                  </p>
                  <div className="tcdCardHeader stdTopicQuizHeader">
                    <button
                      type="button"
                      className="tcdBtn ghost"
                      disabled={!topic?.bonus_quiz_available}
                      onClick={() =>
                        nav(`/student/classes/${classId}/topics/${topicId}/bonus-quiz`)
                      }
                      title={
                        topic?.bonus_quiz_available
                          ? ""
                          : "Bonus je dostupný po dokončení hlavního kvízu, s uloženými studentskými poznámkami a kvízem od učitele."
                      }
                    >
                      Bonusový kvíz
                    </button>
                  </div>
                </div>
                <div className="stdTopicQuizCardArt" aria-hidden="true">
                  <img
                    className="stdTopicQuizRobotImg"
                    src={studyRobot}
                    alt=""
                    decoding="async"
                  />
                </div>
              </div>
            </div>

            <div className="tcdCard">
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Tvoje výsledky hlavního kvízu</div>
              </div>
              {mainQuizAttempts.length === 0 ? (
                <div className="tcdEmpty">Zatím nemáš žádný dokončený hlavní kvíz uložený v této kapitole.</div>
              ) : (
                <ul className="stdAttemptsList" aria-label="Seznam pokusů o hlavní kvíz">
                  {mainQuizAttempts.map((a) => (
                    <li key={a.attempt_id} className="stdAttemptsRow">
                      <div className="stdAttemptsRowMain">
                        <span className="stdAttemptsScore">
                          {formatScore(a.score)} / {formatScore(a.max_score)} bodů
                        </span>
                      </div>
                      <div className="stdAttemptsRowMeta">
                        <span>{formatFinishedAtCs(a.finished_at)}</span>
                        <span className="stdAttemptsDur">{formatDurationSec(a.duration_sec)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="tcdCard">
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Výsledky kvízu ve třídě</div>
              </div>
              {!leaderboard ? (
                <div className="tcdEmpty">Žebříček se nepodařilo načíst.</div>
              ) : (
                <>
                  {leaderboard.podium.length === 0 ? (
                    <div className="tcdEmpty">
                      V této kapitole zatím nikdo nedokončil hlavní kvíz – žebříček je prázdný.
                    </div>
                  ) : (
                    <ul className="stdLbPodium" aria-label="První tři podle nejlepšího výsledku hlavního kvízu">
                      {leaderboard.podium.map((row) => (
                        <li key={row.student_id} className="stdLbPodiumRow">
                          <span className="stdLbMedalWrap">
                            <PodiumMedal place={row.place} />
                          </span>
                          <div className="stdLbPodiumBody">
                            <div className="stdLbPodiumName">{row.display_name}</div>
                            <div className="stdLbPodiumScore">{formatScore(row.best_score)} bodů</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <hr className="stdLbDivider" />
                  <div className="stdLbMine">
                    {leaderboard.my_rank != null ? (
                      <p className="stdLbMineLine">
                        <span className="stdLbMineLabel">Tvé místo:</span>{" "}
                        <strong className="stdLbMineRank">{leaderboard.my_rank}.</strong>
                        <span className="stdLbMineDash"> – </span>
                        <span className="stdLbMineScore">{formatScore(leaderboard.my_best_score)} bodů</span>
                      </p>
                    ) : (
                      <p className="stdLbMineLine stdLbMineLine--muted">
                        Tvé místo: zatím nemáš dokončený hlavní kvíz v této kapitole.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
