import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import Modal from "../components/Modal";
import TopicLineChart from "../components/class-stats/TopicLineChart";
import { useLogout } from "../hooks/useLogout";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../constants/backgroundDecorPresets";
import { useClassStats } from "../hooks/teacher-class/useClassStats";
import { getClassDetail, getTeacherClassStudentStatsDetail } from "../api/api";

import "./TeacherClassDetail.css";
import "./TeacherTopicQuizStats.css";
import "./TeacherClassStats.css";

import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";

function formatPct(n) {
  if (n == null || typeof n !== "number" || !Number.isFinite(n)) return "—";
  return `${Math.round(n * 10) / 10} %`;
}

function formatMmSs(sec) {
  if (sec == null || typeof sec !== "number" || !Number.isFinite(sec) || sec < 0) return "—";
  const sTotal = Math.round(sec);
  const m = Math.floor(sTotal / 60);
  const s = sTotal % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatFinishedAt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });
}

function riskLevelClass(level) {
  if (level === "high") return "tcsRiskBadge tcsRiskBadge--high";
  if (level === "medium") return "tcsRiskBadge tcsRiskBadge--medium";
  return "tcsRiskBadge tcsRiskBadge--low";
}

function riskLevelLabel(level) {
  if (level === "high") return "Vysoké";
  if (level === "medium") return "Střední";
  return "Nízké";
}

export default function TeacherClassStats() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const logout = useLogout();
  const randomDecos = useRandomDecorations(backgroundDecorPresets.classTopicDetail);

  const [classTitle, setClassTitle] = useState("");
  /** Průměr vs medián pro grafy třídy podle témat (skóre + čas) */
  const [classTopicAgg, setClassTopicAgg] = useState("avg");
  /** Který graf zobrazit: skóre, čas nebo dokončení */
  const [classTopicChartKind, setClassTopicChartKind] = useState("score");

  const [studentDetailOpen, setStudentDetailOpen] = useState(false);
  const [studentDetailTitle, setStudentDetailTitle] = useState("");
  const [studentDetail, setStudentDetail] = useState(null);
  const [studentDetailLoading, setStudentDetailLoading] = useState(false);
  const [studentDetailError, setStudentDetailError] = useState("");

  const {
    topicId,
    setTopicId,
    thresholdPercent,
    setThresholdPercent,
    topicOptions,
    topicsLoading,
    topicsError,
    overview,
    topicRows,
    risk,
    loading,
    error,
    riskRegenerating,
    riskRegenerateError,
    regenerateRisk,
  } = useClassStats(classId);

  const loadClassTitle = useCallback(async () => {
    if (!classId) return;
    try {
      const cls = await getClassDetail(classId);
      const label =
        (cls?.custom_name || "").trim() ||
        (cls?.grade != null && cls?.subject ? `${cls.grade}. třída – ${cls.subject}` : "") ||
        cls?.subject ||
        `Třída ${classId}`;
      setClassTitle(label);
    } catch {
      setClassTitle(`Třída ${classId}`);
    }
  }, [classId]);

  useEffect(() => {
    loadClassTitle();
  }, [loadClassTitle]);

  const openStudentDetail = useCallback(
    async (row) => {
      const name =
        `${row.first_name || ""} ${row.last_name || ""}`.trim() || `Student ${row.student_id}`;
      setStudentDetailTitle(`Detail — ${name}`);
      setStudentDetailOpen(true);
      setStudentDetail(null);
      setStudentDetailError("");
      setStudentDetailLoading(true);
      try {
        const d = await getTeacherClassStudentStatsDetail(classId, row.student_id, { topicId });
        setStudentDetail(d);
      } catch (e) {
        setStudentDetailError(e?.message || "Nepodařilo se načíst detail.");
      } finally {
        setStudentDetailLoading(false);
      }
    },
    [classId, topicId]
  );

  const closeStudentDetail = useCallback(() => {
    setStudentDetailOpen(false);
    setStudentDetail(null);
    setStudentDetailError("");
    setStudentDetailTitle("");
  }, []);

  const classChartLabels = useMemo(
    () =>
      topicRows.map((r) => (r.topic_title || "").trim() || `Téma ${r.topic_id}`),
    [topicRows]
  );

  const classScoreChartValues = useMemo(
    () =>
      topicRows.map((r) => {
        const v =
          classTopicAgg === "median" ? r.median_score_percent : r.avg_score_percent;
        return v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
      }),
    [topicRows, classTopicAgg]
  );

  const classDurationChartValues = useMemo(
    () =>
      topicRows.map((r) => {
        const v =
          classTopicAgg === "median" ? r.median_duration_sec : r.avg_duration_sec;
        return v != null && Number.isFinite(Number(v)) ? Number(v) : 0;
      }),
    [topicRows, classTopicAgg]
  );

  const classCompletionChartValues = useMemo(
    () => topicRows.map((r) => (Number.isFinite(r.completion_percent) ? r.completion_percent : 0)),
    [topicRows]
  );

  const studentChartLabels = useMemo(
    () => (studentDetail?.topics || []).map((t) => (t.topic_title || "").trim() || `Téma ${t.topic_id}`),
    [studentDetail]
  );

  const thresholdOptions = [40, 50, 60, 70, 80];

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
          <h1 className="tcdTitle">Statistika třídy</h1>
          <div className="tcdHeaderActions">
            <div className="tcdSubtitle">{classTitle}</div>
            <button
              type="button"
              className="tcdBtn ghost"
              onClick={() => navigate(`/teacher/classes/${classId}`)}
            >
              ← Třída
            </button>
          </div>
        </div>

        <div className="tcdCard tcsFiltersCard">
          <div className="tcdCardHeader">
            <div className="tcdCardTitle">Filtry</div>
          </div>
          <div className="tcsFilters">
            <label className="tcsFilterField">
              <span className="tcsFilterLabel">Téma</span>
              <select
                className="tcsSelect"
                value={topicId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setTopicId(v === "" ? null : Number(v));
                }}
                disabled={topicsLoading}
              >
                <option value="">Všechna témata v třídě</option>
                {topicOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {(t.title || "").trim() || `Téma ${t.id}`}
                    {t.active === false ? " (neaktivní)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="tcsFilterField">
              <span className="tcsFilterLabel">Práh rizika (% skóre)</span>
              <select
                className="tcsSelect"
                value={String(thresholdPercent)}
                onChange={(e) => setThresholdPercent(Number(e.target.value))}
              >
                {thresholdOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} %
                  </option>
                ))}
              </select>
            </label>
          </div>
          {topicsError ? <div className="tcdError tcsFilterNote">{topicsError}</div> : null}
        </div>

        {error && <div className="tcdError">{error}</div>}
        {loading && <div className="tcdLoading tcdLoading--darkText">Načítám…</div>}

        {!loading && overview && (
          <>
            <div className="tcdCard" style={{ marginTop: 12 }}>
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Přehled</div>
              </div>
              <div className="tcsOverviewMetrics">
                <div className="ttsMetricsGrid" aria-label="Souhrnné metriky třídy">
                    <div className="ttsMetricCard ttsMetricCard--avgScore">
                      <div className="ttsMetricCardLabel">Průměr skóre</div>
                      <div className="ttsMetricCardBody">
                        <span className="ttsMetricCardIcon" aria-hidden="true">
                          ✓
                        </span>
                        <div className="ttsMetricCardValue">
                          {formatPct(overview.avg_score_percent)}
                        </div>
                      </div>
                    </div>
                    <div className="ttsMetricCard ttsMetricCard--medianScore">
                      <div className="ttsMetricCardLabel">Medián skóre</div>
                      <div className="ttsMetricCardBody">
                        <span className="ttsMetricCardIcon" aria-hidden="true">
                          ≈
                        </span>
                        <div className="ttsMetricCardValue">
                          {formatPct(overview.median_score_percent)}
                        </div>
                      </div>
                    </div>
                    <div className="ttsMetricCard ttsMetricCard--avgTime">
                      <div className="ttsMetricCardLabel">Aktivita 7 dní</div>
                      <div className="ttsMetricCardBody">
                        <span className="ttsMetricCardIcon" aria-hidden="true">
                          7d
                        </span>
                        <div className="ttsMetricCardValue">
                          {overview.active_students_7d} ({formatPct(overview.active_students_7d_percent)})
                        </div>
                      </div>
                    </div>
                    <div className="ttsMetricCard ttsMetricCard--medianTime">
                      <div className="ttsMetricCardLabel">Aktivita 30 dní</div>
                      <div className="ttsMetricCardBody">
                        <span className="ttsMetricCardIcon" aria-hidden="true">
                          30d
                        </span>
                        <div className="ttsMetricCardValue">
                          {overview.active_students_30d} ({formatPct(overview.active_students_30d_percent)})
                        </div>
                      </div>
                    </div>
                    <div className="ttsMetricCard ttsMetricCardSpan">
                      <div className="ttsMetricCardLabel">Pod prahem ({overview.risk_threshold_percent} %)</div>
                      <div className="ttsMetricCardBody">
                        <span className="ttsMetricCardIcon" aria-hidden="true">
                          ⚠
                        </span>
                        <div className="ttsMetricCardValue">{overview.students_below_threshold} studentů</div>
                      </div>
                    </div>
                  </div>
                <p className="ttsOverviewHint tcsOverviewHint">
                  Průměr, medián a „pod prahem“ počítáme z <strong>nejlepšího</strong> dokončeného hlavního pokusu
                  každého studenta (nejvyšší % úspěšnosti) napříč aktuálním výběrem témat. Aktivita 7/30 dní = student
                  měl v období alespoň jeden dokončený hlavní pokus. Filtry výše platí pro celou stránku.
                </p>
              </div>
            </div>

            <div className="tcdCard" style={{ marginTop: 12 }}>
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Třída podle témat</div>
              </div>
              {!topicRows.length ? (
                <div className="tcdEmpty">Žádná témata v rozsahu filtru — grafy nelze zobrazit.</div>
              ) : (
                <>
                  <div className="tcsClassTopicChartBar">
                    <label className="tcsFilterField tcsClassTopicChartSelect">
                      <span className="tcsFilterLabel">Graf</span>
                      <select
                        className="tcsSelect"
                        value={classTopicChartKind}
                        onChange={(e) => setClassTopicChartKind(e.target.value)}
                        aria-label="Typ grafu"
                      >
                        <option value="score">Skóre (%)</option>
                        <option value="duration">Čas</option>
                        <option value="completion">Dokončení</option>
                      </select>
                    </label>
                    {classTopicChartKind !== "completion" ? (
                      <div className="tcsTrendToggles tcsTrendToggles--inline" role="tablist" aria-label="Agregace třídy">
                        <button
                          type="button"
                          className={`tcsPill ${classTopicAgg === "avg" ? "tcsPill--active" : ""}`}
                          onClick={() => setClassTopicAgg("avg")}
                        >
                          Průměr třídy
                        </button>
                        <button
                          type="button"
                          className={`tcsPill ${classTopicAgg === "median" ? "tcsPill--active" : ""}`}
                          onClick={() => setClassTopicAgg("median")}
                        >
                          Medián třídy
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="ttsOverviewHint tcsTrendHint">
                    Stejná logika jako tabulka <strong>Témata</strong> níže: u každého studenta se bere{" "}
                    <strong>nejlepší</strong> hlavní pokus v tématu. U grafů{" "}
                    <strong>skóre</strong> a <strong>času</strong> volíš průměr nebo medián třídy;{" "}
                    <strong>dokončení</strong> je podíl zapsaných s alespoň jedním dokončeným pokusem.
                  </p>
                  <div className="tcsClassTopicCharts">
                    {classTopicChartKind === "score" ? (
                      <TopicLineChart
                        title={
                          classTopicAgg === "median"
                            ? "Medián skóre třídy na téma (%)"
                            : "Průměr skóre třídy na téma (%)"
                        }
                        labels={classChartLabels}
                        values={classScoreChartValues}
                        formatYTick={(v) => `${Math.round(v * 10) / 10} %`}
                      />
                    ) : null}
                    {classTopicChartKind === "duration" ? (
                      <TopicLineChart
                        title={
                          classTopicAgg === "median"
                            ? "Medián času třídy na téma (nejlepší pokus)"
                            : "Průměr času třídy na téma (nejlepší pokus)"
                        }
                        labels={classChartLabels}
                        values={classDurationChartValues}
                        formatYTick={(v) => formatMmSs(Math.round(v))}
                      />
                    ) : null}
                    {classTopicChartKind === "completion" ? (
                      <TopicLineChart
                        title="Dokončení na téma (podíl studentů s pokusem)"
                        labels={classChartLabels}
                        values={classCompletionChartValues}
                        formatYTick={(v) => `${Math.round(v * 10) / 10} %`}
                      />
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <div className="tcdCard" style={{ marginTop: 12 }}>
              <div className="tcdCardHeader">
                <div className="tcdCardTitle">Témata</div>
              </div>
              {!topicRows.length ? (
                <div className="tcdEmpty">Žádná témata nebo žádná data v rozsahu filtru.</div>
              ) : (
                <div className="ttsTableWrap">
                  <p className="ttsOverviewHint tcsTableHint">
                    Dokončení = podíl zapsaných studentů s alespoň jedním dokončeným hlavním pokusem.
                    Průměr a medián % a <strong>průměrný / mediánní čas</strong> počítáme u každého studenta z
                    jeho <strong>nejlepšího</strong> pokusu v daném tématu (nejvyšší % úspěšnosti; délka toho
                    pokusu).
                  </p>
                  <table className="ttsTable">
                    <thead>
                      <tr>
                        <th>Téma</th>
                        <th
                          className="ttsMid"
                          title="Podíl zapsaných studentů s alespoň jedním dokončeným hlavním pokusem"
                        >
                          Dokončení
                        </th>
                        <th
                          className="ttsMid"
                          title="Průměr z nejlepšího pokusu (nejvyšší % úspěšnosti) u každého studenta"
                        >
                          Průměr %
                        </th>
                        <th
                          className="ttsMid"
                          title="Medián z nejlepšího pokusu u každého studenta"
                        >
                          Medián %
                        </th>
                        <th
                          className="ttsMid"
                          title="Průměr doby trvání (mm:ss) u nejlepšího pokusu každého studenta"
                        >
                          Prům. čas
                        </th>
                        <th
                          className="ttsMid"
                          title="Medián doby trvání (mm:ss) u nejlepšího pokusu každého studenta"
                        >
                          Med. čas
                        </th>
                        <th>Poslední aktivita</th>
                        <th className="ttsActionsCell">Akce</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topicRows.map((row) => (
                        <tr key={row.topic_id}>
                          <td className="ttsPromptCell">
                            {(row.topic_title || "").trim() || (
                              <span className="ttsMuted">Téma {row.topic_id}</span>
                            )}
                            {row.active === false ? (
                              <span className="ttsMuted"> · neaktivní</span>
                            ) : null}
                          </td>
                          <td className="ttsMid">{formatPct(row.completion_percent)}</td>
                          <td className="ttsMid">{formatPct(row.avg_score_percent)}</td>
                          <td className="ttsMid">{formatPct(row.median_score_percent)}</td>
                          <td className="ttsMid">{formatMmSs(row.avg_duration_sec)}</td>
                          <td className="ttsMid">{formatMmSs(row.median_duration_sec)}</td>
                          <td>{formatFinishedAt(row.last_attempt_at)}</td>
                          <td className="ttsActionsCell">
                            <button
                              type="button"
                              className="tcdBtn compact primary"
                              onClick={() =>
                                navigate(`/teacher/classes/${classId}/topics/${row.topic_id}/stats`)
                              }
                            >
                              Statistiky kvízu
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="tcdCard tcsRiskCard" style={{ marginTop: 12 }}>
              <div className="tcdCardHeader tcsRiskHeader">
                <div className="tcdCardTitle">Na koho se zaměřit</div>
                <div className="tcsRiskHeaderActions">
                  {risk?.generated_at ? (
                    <span className="ttsMuted tcsRiskGenerated">
                      AI hodnocení: {formatFinishedAt(risk.generated_at)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="tcdBtn compact"
                    disabled={riskRegenerating}
                    onClick={() => regenerateRisk()}
                  >
                    {riskRegenerating ? "Přegenerovávám…" : "Přegenerovat AI"}
                  </button>
                </div>
              </div>
              {riskRegenerateError ? (
                <div className="tcdError" style={{ marginBottom: 8 }}>
                  {riskRegenerateError}
                </div>
              ) : null}
              <p className="ttsOverviewHint">
                Seřazeno podle AI odhadnutého rizika (práh skóre pro data:{" "}
                <strong>{risk?.threshold_percent ?? thresholdPercent} %</strong>). Sloupec{" "}
                <strong>Doporučení</strong> vyplní model po úspěšném AI vyhodnocení — použijte{" "}
                <strong>Přegenerovat AI</strong>, pokud ho ještě nemáte nebo chcete aktualizovat.
              </p>
              {!risk || !risk.students || risk.students.length === 0 ? (
                <div className="tcdEmpty">Žádní studenti v rizikovém přehledu (nebo data zatím nejsou).</div>
              ) : (
                <div className="ttsTableWrap">
                  <table className="ttsTable">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th className="ttsMid">Riziko</th>
                        <th
                          className="ttsMid"
                          title="Souhrnné rizikové skóre z AI (0 = nižší riziko, 100 = vyšší riziko)"
                        >
                          AI skóre
                        </th>
                        <th
                          className="ttsMid"
                          title="Průměr procenta úspěšnosti ze všech dokončených hlavních pokusů studenta v rozsahu filtru"
                        >
                          Průměr % pokusů
                        </th>
                        <th
                          className="ttsMid"
                          title="Kolik procent z témat v rozsahu má student alespoň jeden dokončený pokus"
                        >
                          Dokončení
                        </th>
                        <th>Poslední aktivita</th>
                        <th>Důvody</th>
                        <th
                          title="Konkrétní návrhy pro práci se studentem (generuje AI)"
                        >
                          Doporučení pro učitele
                        </th>
                        <th className="ttsActionsCell">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {risk.students.map((s) => (
                        <tr key={s.student_id}>
                          <td>
                            {s.first_name} {s.last_name}
                          </td>
                          <td className="ttsMid">
                            <span className={riskLevelClass(s.risk_level)} title={s.risk_level}>
                              {riskLevelLabel(s.risk_level)}
                            </span>
                          </td>
                          <td className="ttsMid">{s.risk_score}</td>
                          <td className="ttsMid">{formatPct(s.avg_score_percent)}</td>
                          <td className="ttsMid">{formatPct(s.completion_percent)}</td>
                          <td>{formatFinishedAt(s.last_attempt_at)}</td>
                          <td className="tcsReasonsCell">
                            {(s.reasons || []).length ? (
                              <ul className="tcsReasonsList">
                                {s.reasons.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="ttsMuted">—</span>
                            )}
                          </td>
                          <td className="tcsReasonsCell tcsTeacherRecCell">
                            {s.teacher_recommendation != null &&
                            String(s.teacher_recommendation).trim() !== "" ? (
                              <p className="tcsTeacherRecText">{String(s.teacher_recommendation).trim()}</p>
                            ) : (
                              <span className="ttsMuted">—</span>
                            )}
                          </td>
                          <td className="ttsActionsCell">
                            <button
                              type="button"
                              className="tcdBtn compact"
                              onClick={() => openStudentDetail(s)}
                            >
                              Detail
                            </button>
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
        open={studentDetailOpen}
        onClose={closeStudentDetail}
        title={studentDetailTitle || "Detail studenta"}
        panelClassName="tcsStudentDetailModal"
      >
        {studentDetailLoading && (
          <div className="tcdLoading tcdLoading--darkText">Načítám…</div>
        )}
        {studentDetailError ? <div className="tcdError">{studentDetailError}</div> : null}
        {!studentDetailLoading && studentDetail ? (
          <>
            <div className="mdBody tcsStudentDetailMd">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {studentDetail.summary_markdown || ""}
              </ReactMarkdown>
            </div>
            <div className="tcsStudentDetailCharts">
              <TopicLineChart
                title="Pokusů hlavního kvízu na téma"
                labels={studentChartLabels}
                values={(studentDetail.topics || []).map((t) => t.main_attempt_count)}
                formatYTick={(v) => String(Math.round(v))}
              />
              <TopicLineChart
                title="Max. počet bodů na téma"
                labels={studentChartLabels}
                values={(studentDetail.topics || []).map((t) => t.max_score)}
                formatYTick={(v) => `${Math.round(v * 10) / 10}`}
              />
              <TopicLineChart
                title="Průměrný čas na téma (na jeden pokus)"
                labels={studentChartLabels}
                values={(studentDetail.topics || []).map((t) =>
                  t.avg_duration_sec != null ? t.avg_duration_sec : 0
                )}
                formatYTick={(v) => formatMmSs(Math.round(v))}
              />
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
