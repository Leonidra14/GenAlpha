import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import Modal from "../components/Modal";
import { useLogout } from "../hooks/useLogout";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../constants/backgroundDecorPresets";
import {
  fetchTopicHeader,
  getTeacherTopicQuizStats,
  getTeacherStudentQuizAttemptDetail,
} from "../api/api";

import "./TeacherClassDetail.css";
import "./TeacherTopicQuizStats.css";

import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";

const DONUT_R = 46;
const DONUT_C = 2 * Math.PI * DONUT_R;

function formatMmSs(sec) {
  if (sec == null || typeof sec !== "number" || !Number.isFinite(sec) || sec < 0) return "—";
  const sTotal = Math.round(sec);
  const m = Math.floor(sTotal / 60);
  const s = sTotal % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPct(n) {
  if (n == null || typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10} %`;
}

function formatOneDecimal(n) {
  if (n == null || typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10}`;
}

function formatFinishedAt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
}

function formatScorePair(score, maxScore) {
  if (score == null || maxScore == null) return "—";
  return `${formatOneDecimal(score)} / ${formatOneDecimal(maxScore)}`;
}

function getMatrixCellTitle(studentRow, question, cell, questionIndex) {
  const studentName =
    `${studentRow?.first_name || ""} ${studentRow?.last_name || ""}`.trim() ||
    `Student ${studentRow?.student_id ?? ""}`;
  const qPrompt = (question?.prompt || "").trim() || question?.question_id || "—";
  const answer = cell?.student_answer != null && String(cell.student_answer).trim() !== ""
    ? String(cell.student_answer).trim()
    : "—";
  const verdict = !cell?.has_answer ? "Bez odpovědi" : cell?.is_correct ? "Správně" : "Špatně";
  return `${studentName}\nOtázka ${questionIndex + 1}: ${qPrompt}\nOdpověď: ${answer}\nVýsledek: ${verdict}`;
}

function normalizeTeacherAnswerFields(answer) {
  if (!answer || typeof answer !== "object") return answer;
  return {
    ...answer,
    student_answer: answer.student_answer ?? answer.studentAnswer ?? "",
    correct_answer: answer.correct_answer ?? answer.correctAnswer ?? null,
    score_delta: answer.score_delta ?? answer.scoreDelta ?? 0,
    teacher_summary: answer.teacher_summary ?? answer.teacherSummary ?? null,
    teacher_recommendation:
      answer.teacher_recommendation ?? answer.teacherRecommendation ?? null,
    final_open_criteria: answer.final_open_criteria ?? answer.finalOpenCriteria ?? null,
  };
}

const FINAL_OPEN_CRITERION_ORDER = [
  ["task_fulfillment", "Splnění zadání"],
  ["topic_accuracy", "Faktická správnost"],
  ["coherence", "Souvislost"],
  ["length_requirement", "Délka odpovědi"],
];

function FinalOpenTeacherRubric({ answer }) {
  if (answer.type !== "final_open") return null;
  const summary = answer.teacher_summary != null ? String(answer.teacher_summary).trim() : "";
  const recommendation =
    answer.teacher_recommendation != null ? String(answer.teacher_recommendation).trim() : "";
  const crit = answer.final_open_criteria;
  const hasCriteria =
    crit &&
    typeof crit === "object" &&
    FINAL_OPEN_CRITERION_ORDER.some(([key]) => crit[key] != null);
  if (!summary && !recommendation && !hasCriteria) return null;

  return (
    <div className="ttsTeacherOnlyBlock">
      <div className="ttsTeacherOnlyTitle">Pouze pro učitele (hodnocení modelu)</div>
      {summary ? (
        <div className="ttsAnswerRow">
          <span className="ttsMuted">Souhrn:</span> {summary}
        </div>
      ) : null}
      {recommendation ? (
        <div className="ttsAnswerRow">
          <span className="ttsMuted">Doporučení:</span> {recommendation}
        </div>
      ) : null}
      {hasCriteria ? (
        <div className="ttsRubricList">
          {FINAL_OPEN_CRITERION_ORDER.map(([key, label]) => {
            const row = crit[key];
            if (!row || typeof row !== "object") return null;
            const sc = row.score;
            const reason = row.reason != null ? String(row.reason).trim() : "";
            return (
              <div key={key} className="ttsRubricRow">
                <div className="ttsRubricHead">
                  <span className="ttsRubricLabel">{label}</span>
                  <span className="ttsRubricScore">
                    {typeof sc === "number" && Number.isFinite(sc) ? `${sc} / 5` : "—"}
                  </span>
                </div>
                {reason ? <div className="ttsRubricReason">{reason}</div> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CompletionDonut({ completedCount, enrolledCount, completionPercent }) {
  const enrolled = Math.max(0, Number(enrolledCount) || 0);
  const completed = Math.max(0, Math.min(enrolled, Number(completedCount) || 0));
  const p =
    enrolled > 0
      ? Math.min(100, Math.max(0, (100 * completed) / enrolled))
      : Math.min(100, Math.max(0, Number(completionPercent) || 0));
  const arc = (p / 100) * DONUT_C;
  const centerMain = enrolled > 0 ? `${completed} / ${enrolled}` : "0 / 0";
  const centerSub = "dokončilo";

  return (
    <div className="ttsDonutWrap">
      <svg
        className="ttsDonutSvg"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Dokončeno ${completed} ze ${enrolled} zapsaných studentů`}
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
            stroke="#5b7cff"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${DONUT_C - arc}`}
          />
        </g>
        <text x="50" y="46" textAnchor="middle" className="ttsDonutCenter">
          {centerMain}
        </text>
        <text x="50" y="62" textAnchor="middle" className="ttsDonutSub">
          {centerSub}
        </text>
      </svg>
      <div className="ttsLegend">
        <div className="ttsLegendRow">
          <span className="ttsSwatch" style={{ background: "#5b7cff" }} />
          <span>
            Dokončilo kvíz: <strong>{completed}</strong> z <strong>{enrolled}</strong> zapsaných
          </span>
        </div>
        <div className="ttsLegendRow">
          <span className="ttsSwatch" style={{ background: "rgba(226, 232, 240, 0.95)" }} />
          <span>Podíl: {formatPct(p)} (hlavní kvíz, uložené pokusy)</span>
        </div>
      </div>
    </div>
  );
}

export default function TeacherTopicQuizStats() {
  const { classId, topicId } = useParams();
  const navigate = useNavigate();
  const logout = useLogout();
  const randomDecos = useRandomDecorations(backgroundDecorPresets.classTopicDetail);

  const [header, setHeader] = useState({ classTitle: "", topicTitle: "" });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailContext, setDetailContext] = useState({ name: "" });

  const [finalOpenOpen, setFinalOpenOpen] = useState(false);
  const [finalOpenLoading, setFinalOpenLoading] = useState(false);
  const [finalOpenError, setFinalOpenError] = useState("");
  const [finalOpenAnswer, setFinalOpenAnswer] = useState(null);
  const [finalOpenTitle, setFinalOpenTitle] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const [h, s] = await Promise.all([
        fetchTopicHeader(classId, topicId),
        getTeacherTopicQuizStats(classId, topicId),
      ]);
      setHeader({ classTitle: h.classTitle || "", topicTitle: h.topicTitle || "" });
      setStats(s);
    } catch (e) {
      setStats(null);
      setError(e?.message || "Nepodařilo se načíst statistiky.");
    } finally {
      setLoading(false);
    }
  }, [classId, topicId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openAttemptDetail(studentRow) {
    const aid = studentRow?.latest_attempt_id;
    const sid = studentRow?.student_id;
    if (!aid || sid == null) return;
    const name = `${studentRow.first_name || ""} ${studentRow.last_name || ""}`.trim() || `Student ${sid}`;
    setDetailContext({ name });
    setDetail(null);
    setDetailError("");
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const d = await getTeacherStudentQuizAttemptDetail(classId, topicId, sid, aid);
      setDetail({
        ...d,
        answers: (d.answers || []).map((a) => normalizeTeacherAnswerFields(a)),
      });
    } catch (e) {
      setDetailError(e?.message || "Nepodařilo se načíst detail pokusu.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function openFinalOpenQuick(studentRow) {
    const aid = studentRow?.latest_attempt_id;
    const sid = studentRow?.student_id;
    if (!aid || sid == null) return;
    const name =
      `${studentRow.first_name || ""} ${studentRow.last_name || ""}`.trim() ||
      `Student #${sid}`;
    setFinalOpenTitle(name);
    setFinalOpenAnswer(null);
    setFinalOpenError("");
    setFinalOpenOpen(true);
    setFinalOpenLoading(true);
    try {
      const d = await getTeacherStudentQuizAttemptDetail(classId, topicId, sid, aid);
      const fo = (d.answers || []).find((a) => a.type === "final_open") || null;
      setFinalOpenAnswer(fo ? normalizeTeacherAnswerFields(fo) : null);
    } catch (e) {
      setFinalOpenError(e?.message || "Nepodařilo se načíst otevřenou otázku.");
    } finally {
      setFinalOpenLoading(false);
    }
  }

  function closeFinalOpenModal() {
    setFinalOpenOpen(false);
    setFinalOpenAnswer(null);
    setFinalOpenError("");
  }

  const noQuizConfigured =
    stats &&
    (!stats.per_question || stats.per_question.length === 0) &&
    (stats.quiz_max_score == null || stats.quiz_max_score === 0);
  const matrixQuestions = stats?.answer_matrix_questions || [];
  const matrixRows = stats?.answer_matrix_rows || [];

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
        />

        <div className="tcdHeader">
          <h1 className="tcdTitle">Statistiky kvízu</h1>
          <div className="tcdHeaderActions">
            <div className="tcdSubtitle">
              {header.topicTitle}
              <span className="ttsMuted"> · </span>
              {header.classTitle}
            </div>
            <div className="tcdHeaderButtons">
              <button
                type="button"
                className="tcdBtn ghost"
                onClick={() => navigate(`/teacher/classes/${classId}`)}
              >
                ← Třída
              </button>
              <button
                type="button"
                className="tcdBtn ghost"
                onClick={() => navigate(`/teacher/classes/${classId}/stats`)}
              >
                Statistiky třídy
              </button>
              <button
                type="button"
                className="tcdBtn primarySoft"
                onClick={() => navigate(`/teacher/classes/${classId}/topics/${topicId}`)}
              >
                Kapitola
              </button>
            </div>
          </div>
        </div>

        {error && <div className="tcdError">{error}</div>}

        {loading && <div className="tcdLoading">Načítám…</div>}

        {!loading && stats && (
          <>
            <div className="tcdCard">
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Přehled třídy u tohoto kvízu</div>
              </div>

              {noQuizConfigured && (
                <div className="tcdEmpty" style={{ marginBottom: 12 }}>
                  Pro tuto kapitolu zatím není uložený kvíz (nebo nejde načíst). Statistiky otázek
                  budou k dispozici po uložení kvízu a dokončených pokusech.
                </div>
              )}

              <div className="ttsOverview">
                <div className="ttsOverviewLeft">
                  <div className="tcdSectionTitle ttsOverviewLeftTitle">Dokončení (zapsaní studenti)</div>
                  <CompletionDonut
                    completedCount={stats.completed_count}
                    enrolledCount={stats.enrolled_count}
                    completionPercent={stats.completion_percent}
                  />
                </div>
                <div className="ttsOverviewRight">
                  <div className="ttsMetricsGrid" aria-label="Souhrnné metriky kvízu">
                    <div className="ttsMetricCard ttsMetricCard--avgScore">
                      <div className="ttsMetricCardLabel">Průměr skóre</div>
                      <div className="ttsMetricCardBody">
                        <span className="ttsMetricCardIcon" aria-hidden="true">
                          ✓
                        </span>
                        <div className="ttsMetricCardValue">{formatPct(stats.avg_score_percent)}</div>
                      </div>
                    </div>
                    <div className="ttsMetricCard ttsMetricCard--medianScore">
                      <div className="ttsMetricCardLabel">Medián skóre</div>
                      <div className="ttsMetricCardBody">
                        <span className="ttsMetricCardIcon" aria-hidden="true">
                          ≈
                        </span>
                        <div className="ttsMetricCardValue">{formatPct(stats.median_score_percent)}</div>
                      </div>
                    </div>
                    <div className="ttsMetricCard ttsMetricCard--avgTime">
                      <div className="ttsMetricCardLabel">Průměr času</div>
                      <div className="ttsMetricCardBody">
                        <span className="ttsMetricCardIcon" aria-hidden="true">
                          ⏱
                        </span>
                        <div className="ttsMetricCardValue">{formatMmSs(stats.avg_duration_sec)}</div>
                      </div>
                    </div>
                    <div className="ttsMetricCard ttsMetricCard--medianTime">
                      <div className="ttsMetricCardLabel">Medián času</div>
                      <div className="ttsMetricCardBody">
                        <span className="ttsMetricCardIcon" aria-hidden="true">
                          ⏱
                        </span>
                        <div className="ttsMetricCardValue">{formatMmSs(stats.median_duration_sec)}</div>
                      </div>
                    </div>
                    {stats.quiz_max_score != null && (
                      <div className="ttsMetricCard ttsMetricCardSpan">
                        <div className="ttsMetricCardLabel">Max. skóre (kvíz)</div>
                        <div className="ttsMetricCardBody">
                          <span className="ttsMetricCardIcon" aria-hidden="true">
                            ★
                          </span>
                          <div className="ttsMetricCardValue">{formatOneDecimal(stats.quiz_max_score)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="ttsOverviewNotes">
                  <p className="ttsOverviewHint">
                    Stejní studenti jako v zápisu do třídy. Počítá se <strong>hlavní kvíz</strong>{" "}
                    (uložené dokončené pokusy).
                  </p>
                  <p className="ttsOverviewHint">
                    Průměr a medián skóre a času vycházejí z{" "}
                    <strong>posledního dokončeného hlavního</strong> pokusu u každého studenta, který kvíz
                    alespoň jednou dokončil. Bonusové pokusy se do statistik nezapočítávají.
                  </p>
                </div>
              </div>
            </div>

            <div className="tcdCard" style={{ marginTop: 12 }}>
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Úspěšnost podle otázky</div>
              </div>
              {(!stats.per_question || stats.per_question.length === 0) && (
                <div className="tcdEmpty">Žádná data u otázek.</div>
              )}
              {stats.per_question && stats.per_question.length > 0 && (
                <div className="ttsTableWrap">
                  <table className="ttsTable">
                    <thead>
                      <tr>
                        <th>Otázka</th>
                        <th className="ttsMid">Úspěšnost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.per_question.map((q) => (
                        <tr key={q.question_id}>
                          <td className="ttsPromptCell">
                            {(q.prompt || "").trim() || <span className="ttsMuted">{q.question_id}</span>}
                          </td>
                          <td className="ttsMid">{formatPct(q.correct_rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="tcdCard" style={{ marginTop: 12 }}>
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Odpovědi podle otázky</div>
              </div>
              {matrixQuestions.length === 0 && (
                <div className="tcdEmpty">Mřížku lze zobrazit po vygenerování kvízu a dokončených pokusech.</div>
              )}
              {matrixQuestions.length > 0 && (
                <>
                  <div className="ttsLegend">
                    <div className="ttsLegendRow">
                      <span className="ttsSwatch ttsMatrixSwatchOk" />
                      <span>Správná odpověď</span>
                    </div>
                    <div className="ttsLegendRow">
                      <span className="ttsSwatch ttsMatrixSwatchBad" />
                      <span>Špatná odpověď</span>
                    </div>
                    <div className="ttsLegendRow">
                      <span className="ttsSwatch ttsMatrixSwatchEmpty" />
                      <span>Bez odpovědi / bez dokončeného pokusu</span>
                    </div>
                  </div>
                  <div className="ttsTableWrap ttsMatrixWrap">
                    <table className="ttsTable ttsMatrixTable">
                      <thead>
                        <tr>
                          <th className="ttsMatrixStudentHead">Student</th>
                          {matrixQuestions.map((q, idx) => (
                            <th
                              key={q.question_id}
                              className="ttsMid ttsMatrixQHead"
                              title={(q.prompt || "").trim() || q.question_id}
                            >
                              {idx + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {matrixRows.map((row) => (
                          <tr key={row.student_id}>
                            <td className="ttsMatrixStudentCell">
                              {row.first_name} {row.last_name}
                            </td>
                            {matrixQuestions.map((q, idx) => {
                              const cell =
                                (row.cells || []).find((c) => c.question_id === q.question_id) || null;
                              const cellClass = !cell?.has_answer
                                ? "ttsMatrixCell ttsMatrixCellEmpty"
                                : cell.is_correct
                                ? "ttsMatrixCell ttsMatrixCellOk"
                                : "ttsMatrixCell ttsMatrixCellBad";
                              const symbol = !cell?.has_answer ? "·" : cell.is_correct ? "✓" : "✕";
                              return (
                                <td
                                  key={`${row.student_id}_${q.question_id}`}
                                  className="ttsMid"
                                  title={getMatrixCellTitle(row, q, cell, idx)}
                                >
                                  <span className={cellClass}>{symbol}</span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="tcdCard" style={{ marginTop: 12 }}>
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Studenti</div>
              </div>
              {stats.enrolled_count === 0 && (
                <div className="tcdEmpty">Do třídy není zapsaný žádný student.</div>
              )}
              {stats.enrolled_count > 0 && (!stats.students || stats.students.length === 0) && (
                <div className="tcdEmpty">Žádní studenti k zobrazení.</div>
              )}
              {stats.students && stats.students.length > 0 && (
                <div className="ttsTableWrap">
                  <table className="ttsTable">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th className="ttsMid">Pokusů</th>
                        <th className="ttsMid">Nejlepší %</th>
                        <th className="ttsMid">Poslední výsledek</th>
                        <th>Poslední dokončení</th>
                        <th className="ttsActionsCell">Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.students.map((row) => (
                        <tr key={row.student_id}>
                          <td>
                            {row.first_name} {row.last_name}
                          </td>
                          <td className="ttsMid">{row.attempt_count}</td>
                          <td className="ttsMid">{formatPct(row.best_score_percent)}</td>
                          <td className="ttsMid">{formatScorePair(row.latest_score, row.latest_max_score)}</td>
                          <td>{formatFinishedAt(row.latest_finished_at)}</td>
                          <td className="ttsActionsCell">
                            <div className="ttsActionButtons">
                              <button
                                type="button"
                                className="tcdBtn compact"
                                disabled={!row.latest_attempt_id || !stats.quiz_has_final_open}
                                title={
                                  !stats.quiz_has_final_open
                                    ? "Kvíz nemá otevřenou otázku"
                                    : !row.latest_attempt_id
                                    ? "Student zatím nemá dokončený pokus"
                                    : undefined
                                }
                                onClick={() => openFinalOpenQuick(row)}
                              >
                                Otevřená otázka
                              </button>
                              <button
                                type="button"
                                className="tcdBtn compact primary"
                                disabled={!row.latest_attempt_id}
                                onClick={() => openAttemptDetail(row)}
                              >
                                Detail pokusu
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Modal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
          setDetailError("");
        }}
        title={detailContext.name ? `Pokus — ${detailContext.name}` : "Detail pokusu"}
      >
        {detailLoading && <div className="tcdLoading">Načítám…</div>}
        {detailError && <div className="tcdError">{detailError}</div>}
        {!detailLoading && detail && (
          <>
            <div className="ttsModalMeta">
              <span>
                Skóre: <strong>{formatScorePair(detail.score, detail.max_score)}</strong>
              </span>
              <span>
                Čas: <strong>{formatMmSs(detail.duration_sec)}</strong>
              </span>
              <span>
                Hotovo: <strong>{formatFinishedAt(detail.finished_at)}</strong>
              </span>
              <span>
                Správně / špatně:{" "}
                <strong>
                  {detail.correct_count} / {detail.incorrect_count}
                </strong>
              </span>
            </div>
            <div className="ttsAnswerList">
              {(detail.answers || []).map((a) => (
                <div
                  key={a.question_id}
                  className={`ttsAnswerCard ${a.is_correct ? "ok" : "bad"}`}
                >
                  <div className="ttsAnswerQ">{a.prompt || a.question_id}</div>
                  <div className="ttsAnswerRow">
                    <span className="ttsMuted">Typ:</span> {a.type}
                  </div>
                  <div className="ttsAnswerRow">
                    <span className="ttsMuted">Odpověď studenta:</span> {a.student_answer || "—"}
                  </div>
                  {a.correct_answer != null && (
                    <div className="ttsAnswerRow">
                      <span className="ttsMuted">Správně:</span> {a.correct_answer}
                    </div>
                  )}
                  {a.explanation != null && String(a.explanation).trim() !== "" && (
                    <div className="ttsAnswerRow">
                      <span className="ttsMuted">Vysvětlení:</span> {a.explanation}
                    </div>
                  )}
                  {a.feedback != null && String(a.feedback).trim() !== "" && (
                    <div className="ttsAnswerRow">
                      <span className="ttsMuted">Zpětná vazba (student):</span> {a.feedback}
                    </div>
                  )}
                  <FinalOpenTeacherRubric answer={a} />
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={finalOpenOpen}
        onClose={closeFinalOpenModal}
        title={
          finalOpenTitle
            ? `Otevřená otázka — ${finalOpenTitle}`
            : "Otevřená otázka"
        }
      >
        {finalOpenLoading && <div className="tcdLoading">Načítám…</div>}
        {finalOpenError && <div className="tcdError">{finalOpenError}</div>}
        {!finalOpenLoading && !finalOpenError && finalOpenAnswer == null && (
          <div className="tcdEmpty">
            V posledním uloženém pokusu není řádek pro otevřenou otázku (nebo student kvíz nedokončil).
          </div>
        )}
        {!finalOpenLoading && finalOpenAnswer != null && (
          <div
            className={`ttsAnswerCard ${finalOpenAnswer.is_correct ? "ok" : "bad"}`}
          >
            <div className="ttsAnswerQ">
              {(finalOpenAnswer.prompt || "").trim() || finalOpenAnswer.question_id}
            </div>
            <div className="ttsAnswerRow">
              <span className="ttsMuted">Odpověď studenta:</span>{" "}
              {finalOpenAnswer.student_answer || "—"}
            </div>
            {finalOpenAnswer.feedback != null && String(finalOpenAnswer.feedback).trim() !== "" && (
              <div className="ttsAnswerRow">
                <span className="ttsMuted">Zpětná vazba (AI pro studenta):</span>{" "}
                {finalOpenAnswer.feedback}
              </div>
            )}
            <FinalOpenTeacherRubric answer={finalOpenAnswer} />
          </div>
        )}
      </Modal>
    </div>
  );
}
