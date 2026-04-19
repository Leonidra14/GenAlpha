import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import { useLogout } from "../hooks/useLogout";
import { getStudentQuizAttemptDetail, getStudentTopicDetail } from "../api/api";
import { normalizeMd } from "../utils/markdown";

import "./TeacherClassDetail.css";
import "./StudentQuizSession.css";
import "./StudentQuizResults.css";

import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight2.png";
import robotBest from "../assets/best.png";
import robotSad from "../assets/sad.png";
import robotNormal from "../assets/normal.png";
import robotHappy from "../assets/happy.png";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../constants/backgroundDecorPresets";
import {
  MASCOT_BEST_MESSAGES,
  MASCOT_HAPPY_MESSAGES,
  MASCOT_NORMAL_MESSAGES,
  MASCOT_SAD_MESSAGES,
} from "../constants/quizMascotMessages";

const DONUT_R = 42;
const DONUT_C = 2 * Math.PI * DONUT_R;

function promptLooksLikeMarkdown(s) {
  const t = (s ?? "").trim();
  if (!t) return false;
  return /(^|\n)#{1,6}\s|\*\*.+\*\*|__.+__|(^|\n)\s*[-*]\s|```/.test(t);
}

function formatTotalDurationSeconds(durationSec) {
  if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec < 0) return "—";
  const secTotal = Math.round(durationSec);
  if (secTotal < 60) return `${secTotal} s`;
  const m = Math.floor(secTotal / 60);
  const s = secTotal % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

function formatFinishedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" });
}

/** Format score without a trailing ".0" for integers. */
function formatScoreForDisplay(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  const rounded = Math.round(x * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  const s = rounded.toFixed(2).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return s;
}

function pickRandomMascotMessage(messages) {
  if (!messages.length) return "";
  const idx = Math.floor(Math.random() * messages.length);
  return messages[idx];
}

/** Pick mascot image/message by correct %, then random line in that bucket. */
function mascotForCorrectPct(pctRaw) {
  const p = Math.min(100, Math.max(0, Number(pctRaw) || 0));
  if (p > 85) {
    return {
      src: robotBest,
      alt: "Robot oslavuje výborný výsledek",
      message: pickRandomMascotMessage(MASCOT_BEST_MESSAGES),
    };
  }
  if (p <= 30) {
    return {
      src: robotSad,
      alt: "Robot je smutný z výsledku",
      message: pickRandomMascotMessage(MASCOT_SAD_MESSAGES),
    };
  }
  if (p <= 55) {
    return {
      src: robotNormal,
      alt: "Robot hodnotí výsledek neutrálně",
      message: pickRandomMascotMessage(MASCOT_NORMAL_MESSAGES),
    };
  }
  return {
    src: robotHappy,
    alt: "Robot se raduje z výsledku",
    message: pickRandomMascotMessage(MASCOT_HAPPY_MESSAGES),
  };
}

function QuizDonut({ correctPct }) {
  const p = Math.min(100, Math.max(0, correctPct));
  const arc = (p / 100) * DONUT_C;
  const label = `${Math.round(p)} %`;

  return (
    <div className="sqrDonutWrap">
      <svg
        className="sqrDonutSvg"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Správně ${label}`}
      >
        <g transform="rotate(-90 50 50)">
          <circle
            cx="50"
            cy="50"
            r={DONUT_R}
            fill="none"
            stroke="rgba(226, 232, 240, 0.95)"
            strokeWidth="10"
          />
          <circle
            cx="50"
            cy="50"
            r={DONUT_R}
            fill="none"
            stroke="#22c55e"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${DONUT_C - arc}`}
          />
        </g>
        <text x="50" y="48" textAnchor="middle" className="sqrDonutCenter">
          {label}
        </text>
        <text x="50" y="64" textAnchor="middle" className="sqrDonutSub">
          správně
        </text>
      </svg>
    </div>
  );
}

function TileIcon({ variant, children }) {
  return (
    <div
      className={`sqrTileIcon sqrTileIcon--${variant}`}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

export default function StudentQuizResults() {
  const { classId, topicId, attemptId } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  const logout = useLogout();

  const [topicTitle, setTopicTitle] = useState("");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const randomDecos = useRandomDecorations({
    ...backgroundDecorPresets.classTopicDetail,
    starSrc: star,
    flightSrc: flight,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getStudentTopicDetail(classId, topicId);
        if (!cancelled && d?.title != null) {
          setTopicTitle(String(d.title).trim());
        }
      } catch {
        if (!cancelled) setTopicTitle("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, topicId]);

  const previewFromNav = location.state?.quizResultsDetail;

  useEffect(() => {
    let cancelled = false;
    if (previewFromNav) {
      setError("");
      setDetail(previewFromNav);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setError("");
      setLoading(true);
      setDetail(null);
      try {
        if (String(attemptId) === "local") {
          if (!cancelled) {
            setError(
              "Výsledky procvičovacího kvízu jsou k dispozici jen hned po dokončení. Vrať se na kapitolu a spusť bonus znovu.",
            );
          }
          return;
        }
        const d = await getStudentQuizAttemptDetail(classId, topicId, attemptId);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Nepodařilo se načíst výsledky.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, topicId, attemptId, previewFromNav]);

  const backToTopic = () => nav(`/student/classes/${classId}/topics/${topicId}`);

  const stats = useMemo(() => {
    if (!detail) return null;
    const qc = Number(detail.question_count) || 0;
    const cc = Number(detail.correct_count) || 0;
    const pct = qc > 0 ? (cc / qc) * 100 : 0;
    return {
      correctPct: pct,
      mascot: mascotForCorrectPct(pct),
      totalDurationLabel: formatTotalDurationSeconds(detail.duration_sec),
      finishedLabel: formatFinishedAt(detail.finished_at),
    };
  }, [detail]);

  if (loading) {
    return (
      <div className="tcdPage sqrPage">
        <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
        <div className="tcdWrap">
          <div className="tcdLoading">Načítám výsledky…</div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="tcdPage sqrPage">
        <img className="tcdDec tcdClouds" src={clouds} alt="" aria-hidden="true" />
        <div className="tcdWrap">
          <div className="tcdError">{error || "Výsledky nejsou k dispozici."}</div>
          <button type="button" className="tcdBtn ghost" onClick={backToTopic}>
            ← Zpět na kapitolu
          </button>
        </div>
      </div>
    );
  }

  const qc = Number(detail.question_count) || 0;

  return (
    <div className="tcdPage sqrPage">
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
            <button type="button" className="tcdBtn ghost" onClick={backToTopic}>
              ← Zpět
            </button>
          }
        />

        <header className="tcdHeader">
          <div className="sqrHeaderRow">
            <div className="sqrHeaderLead">
              <h1 className="tcdTitle sqrTitle">Výsledky kvízu</h1>
              {topicTitle ? <p className="sqrSubtitle">{topicTitle}</p> : null}
              {stats?.finishedLabel ? (
                <p className="sqrMeta">Dokončeno: {stats.finishedLabel}</p>
              ) : null}
            </div>
            <button type="button" className="tcdBtn primary sqrHeaderBack" onClick={backToTopic}>
              Zpět na kapitolu
            </button>
          </div>
        </header>

        <div className="tcdCard">
          <div className="sqrHero">
            <div className="sqrHeroTop">
              <div className="sqrHeroDonutCell">
                <QuizDonut correctPct={stats.correctPct} />
              </div>
              <div className="sqrHeroRobotCell">
                <img
                  className="sqrMascotImg"
                  src={stats.mascot.src}
                  alt={stats.mascot.alt}
                  width={200}
                  height={200}
                  decoding="async"
                />
              </div>
              <p className="sqsSummaryScores sqrHeroScores">
                Body: {formatScoreForDisplay(detail.score)} /{" "}
                {formatScoreForDisplay(detail.max_score)}
              </p>
              <p className="sqrMascotText sqrHeroMascotText">{stats.mascot.message}</p>
            </div>
            <div className="sqrTiles sqrTiles--heroRow">
              <div className="sqrTile">
                <TileIcon variant="ok">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </TileIcon>
                <div className="sqrTileBody">
                  <div className="sqrTileValue">{detail.correct_count}</div>
                  <div className="sqrTileLabel">Správně</div>
                </div>
              </div>
              <div className="sqrTile">
                <TileIcon variant="bad">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </TileIcon>
                <div className="sqrTileBody">
                  <div className="sqrTileValue">{detail.incorrect_count}</div>
                  <div className="sqrTileLabel">Špatně</div>
                </div>
              </div>
              <div className="sqrTile">
                <TileIcon variant="neutral">
                  <span className="sqrTileHash">#</span>
                </TileIcon>
                <div className="sqrTileBody">
                  <div className="sqrTileValue">{qc}</div>
                  <div className="sqrTileLabel">Celkem otázek</div>
                </div>
              </div>
              <div className="sqrTile">
                <TileIcon variant="time">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </TileIcon>
                <div className="sqrTileBody">
                  <div className="sqrTileValue">{stats.totalDurationLabel}</div>
                  <div className="sqrTileLabel">Celkový čas</div>
                </div>
              </div>
            </div>
          </div>

          <h2 className="sqrListTitle sqrListTitle--sentence">Tvoje odpovědi</h2>

          {(detail.answers || []).map((row, i) => {
            const md = promptLooksLikeMarkdown(row.prompt);
            const promptText = normalizeMd(row.prompt);
            const showPrompt = promptText.length > 0;

            return (
              <article key={`${row.question_id}-${i}`} className="sqrQCard">
                <div className="sqrQRow">
                  <div className="sqrQMain">
                    {showPrompt ? (
                      md ? (
                        <div className="sqrPrompt sqrPrompt--md">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{promptText}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="sqrPrompt">{promptText}</p>
                      )
                    ) : (
                      <p className="sqrPrompt" style={{ opacity: 0.75 }}>
                        (Otázka bez uloženého znění)
                      </p>
                    )}
                    <div className="sqrAnswerBlock">
                      <p className="sqrAnswerLabel">Tvoje odpověď</p>
                      <p className="sqrAnswerText">
                        {row.student_answer != null && String(row.student_answer).trim() !== ""
                          ? row.student_answer
                          : "—"}
                      </p>
                    </div>
                    {row.type === "final_open" && row.feedback ? (
                      <div className="sqrFeedback" role="note">
                        {row.feedback}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className={`sqrQMark ${row.is_correct ? "sqrQMark--ok" : "sqrQMark--bad"}`}
                    aria-label={row.is_correct ? "Správně" : "Špatně"}
                  >
                    {row.is_correct ? "✓" : "✗"}
                  </div>
                </div>
              </article>
            );
          })}

          <div className="sqsActions">
            <button type="button" className="tcdBtn primary" onClick={backToTopic}>
              Zpět na kapitolu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
