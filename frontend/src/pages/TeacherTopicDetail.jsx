import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import "./TeacherClassDetail.css";
import "../styles/topic-common.css";

import clouds from "../assets/clouds.png";
import labs from "../assets/lab_books.png";
import star from "../assets/star.png";
import flight from "../assets/flight.png";
import { normalizeMd } from "../utils/markdown";
import { safeJsonStringify, safeParseJson } from "../utils/json";
import { formatTime } from "../utils/versioning";
import { isImageFile, isPdfFile } from "../utils/fileValidation";
import { useTopicHeaderData } from "../hooks/teacher-topic/useTopicHeaderData";
import { useFileAttachments } from "../hooks/teacher-topic/useFileAttachments";
import { useTopicNotesWorkflow } from "../hooks/teacher-topic/useTopicNotesWorkflow";
import { useTopicQuizWorkflow } from "../hooks/teacher-topic/useTopicQuizWorkflow";
import { useRandomDecorations } from "../hooks/useRandomDecorations";
import { backgroundDecorPresets } from "../constants/backgroundDecorPresets";
import { useLogout } from "../hooks/useLogout";
import AppTopbar from "../components/layout/AppTopbar";
import AppBackgroundDecor from "../components/layout/AppBackgroundDecor";
import TopicTabs from "../components/teacher-topic/TopicTabs";
import VersionHistoryCard from "../components/teacher-topic/VersionHistoryCard";
import TeacherTopicBuildTab from "../components/teacher-topic/TeacherTopicBuildTab";
import TeacherTopicRightPanel from "../components/teacher-topic/TeacherTopicRightPanel";
import Modal from "../components/Modal";

function quizTypeLabelCs(type) {
  switch (type) {
    case "mcq":
      return "Výběr z možností";
    case "yesno":
      return "Ano / Ne";
    case "final_open":
      return "Otevřená otázka";
    default:
      return String(type || "—");
  }
}

export default function TeacherTopicDetail() {
  const { classId, topicId } = useParams();
  const navigate = useNavigate();

  // tabs
  const [tab, setTab] = useState("build"); // build | student | teacher | quiz

  // build inputs
  const [duration, setDuration] = useState(45);
  const [rawText, setRawText] = useState("");

  const [error, setError] = useState("");

  //header info
  const { classTitle, topicTitle, classDetail } = useTopicHeaderData(classId, topicId);

  const [userNote, setUserNote] = useState("");

  // metadata collapsible
  const [showMeta, setShowMeta] = useState(false);

  const [backConfirmOpen, setBackConfirmOpen] = useState(false);

  const { files, fileInputRef, onFilesChange, removeFileAt, clearFiles } = useFileAttachments(setError);
  const notes = useTopicNotesWorkflow({
    classId,
    topicId,
    tab,
    rawText,
    duration,
    files,
    setError,
  });

  const quiz = useTopicQuizWorkflow({
    classId,
    topicId,
    classDetail,
    setError,
  });

  const {
    loading,
    history,
    activeTeacherVersionId,
    setActiveTeacherVersionId,
    activeStudentVersionId,
    setActiveStudentVersionId,
    dbTeacherVersionId,
    dbStudentVersionId,
    regenTarget,
    setRegenTarget,
    regenLoading,
    saveFinalLoading,
    isEditingTeacher,
    setIsEditingTeacher,
    isEditingStudent,
    setIsEditingStudent,
    teacherDraft,
    setTeacherDraft,
    studentDraft,
    setStudentDraft,
    extractedView,
    teacherView,
    studentView,
    hasAnyOutput,
    dbTeacherLabel,
    dbStudentLabel,
    getById,
    onRun,
    onRegenerate,
    saveDraft,
    saveFinalFromActive,
    deleteVersion,
    clearHistory,
  } = notes;

  const {
    quizHistory,
    activeQuizVersionId,
    setActiveQuizVersionId,
    dbQuizVersionId,
    quizLoading,
    quizSaveLoading,
    quizMcq,
    setQuizMcq,
    quizYesNo,
    setQuizYesNo,
    quizFinalOpen,
    setQuizFinalOpen,
    quizDraftJson,
    setQuizDraftJson,
    isEditingQuiz,
    setIsEditingQuiz,
    quizRegenLoading,
    dbQuizLabel,
    getQuizById,
    onGenerateQuiz,
    onRegenerateQuiz,
    onSaveFinalQuiz,
  } = quiz;
  const hasDbTeacher = !!dbTeacherVersionId;
  const hasDbStudent = !!dbStudentVersionId;
  const hasMultipleVersions = history.length > 1 || quizHistory.length > 1;

  const logout = useLogout();

  // decorace
  const randomDecos = useRandomDecorations({
    ...backgroundDecorPresets.classTopicDetail,
    starSrc: star,
    flightSrc: flight,
  });

  const paperBox = {
    background: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    padding: 14,
    color: "#1f2330",
    lineHeight: 1.6,
    overflowX: "auto",
    maxWidth: "100%",
    boxSizing: "border-box",
  };

  const codeTextareaStyle = {
    minHeight: 460,
    resize: "vertical",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: 1.5,
    color: "#1f2330",
    maxWidth: "100%",
    boxSizing: "border-box",
  };

  const noNotesYet =
    (tab === "teacher" && !hasDbTeacher && !activeTeacherVersionId) ||
    (tab === "student" && !hasDbStudent && !activeStudentVersionId);

  async function handleRegenerateNotes() {
    const ok = await onRegenerate(userNote);
    if (ok) setUserNote("");
  }

  async function handleRegenerateQuiz() {
    await onRegenerateQuiz(userNote, () => setUserNote(""));
  }

  function confirmNavigateBackToClass() {
    setBackConfirmOpen(false);
    navigate(`/teacher/classes/${classId}`);
  }

  function handleBackToClass() {
    if (hasMultipleVersions) {
      setBackConfirmOpen(true);
      return;
    }
    navigate(`/teacher/classes/${classId}`);
  }

  useEffect(() => {
    if (!error || !error.startsWith("✅")) return undefined;
    const timer = setTimeout(() => setError(""), 15000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <div className="tcdPage ttdTopicDetailPage">
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

        {/* HEADER */}
        <div className="tcdHeader">
          <div className="tcdHeaderLeft">
            <h1 className="tcdTitle">
              {classTitle || `Třída ${classId}`} –{" "}
              {topicTitle || `Kapitola ${topicId}`}
            </h1>

            <TopicTabs
              tab={tab}
              setTab={setTab}
              hasAnyOutput={hasAnyOutput}
              hasDbTeacher={hasDbTeacher}
              hasDbStudent={hasDbStudent}
              onBack={handleBackToClass}
            />
          </div>
        </div>

        {/* status */}
        {error && (
          <div
            className={error.startsWith("✅") ? "tcdSuccess" : "tcdError"}
            style={{ marginBottom: 12 }}
          >
            {error}
          </div>
        )}

        <div className="ttTopicDetailLayout">
          <div className="ttTopicDetailMain">
            {/* Build tab: version history is delete-only */}
            {tab === "build" && (
              <VersionHistoryCard
                history={history}
                formatTime={formatTime}
                onDelete={deleteVersion}
                onClear={clearHistory}
              />
            )}

            {tab === "build" && (
              <TeacherTopicBuildTab duration={duration} setDuration={setDuration} rawText={rawText} setRawText={setRawText} />
            )}

            {/* STUDENT NOTES */}
            {tab === "student" && (
              <div className="tcdCard">
                <div className="tcdCardHeader" style={{ alignItems: "baseline" }}>
                  <div className="tcdCardTitle">Student Notes</div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ opacity: 0.65, fontSize: 13 }}>
                      verze:{" "}
                      {activeStudentVersionId
                        ? formatTime(getById(activeStudentVersionId)?.createdAt)
                        : "—"}
                    </div>

                    {!isEditingStudent ? (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingStudent(true)}
                        disabled={noNotesYet}
                      >
                        ✏️ Upravit
                      </button>
                    ) : (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingStudent(false)}
                      >
                        👁️ Náhled
                      </button>
                    )}
                  </div>
                </div>

                {noNotesYet ? (
                  <div style={{ ...paperBox, opacity: 0.9 }}>
                    Nejdřív vygenerujte obsah v záložce <b>Tvorba</b>!
                  </div>
                ) : (
                  <>
                    <select
                      className="tcdInput"
                      value={activeStudentVersionId || ""}
                      onChange={(e) => setActiveStudentVersionId(e.target.value || null)}
                      disabled={history.length === 0}
                      style={{ marginBottom: 12 }}
                    >
                      <option value="">
                        {history.length === 0 ? "— žádné verze —" : "Vyber verzi"}
                      </option>
                      {history.map((h, idx) => (
                        <option key={h.id} value={h.id}>
                          {`Verze ${history.length - idx} — ${h.label} — ${formatTime(
                            h.createdAt
                          )}${dbStudentVersionId === h.id ? " ✅ (trvale uloženo)" : ""}`}
                        </option>
                      ))}
                    </select>

                    {!isEditingStudent ? (
                      <div style={paperBox} className="mdBody">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {normalizeMd(studentDraft) || "—"}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <textarea
                        className="tcdInput"
                        value={studentDraft}
                        onChange={(e) => setStudentDraft(e.target.value)}
                        style={codeTextareaStyle}
                      />
                    )}

                    {isEditingStudent && (
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          marginTop: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="tcdBtn"
                          type="button"
                          onClick={() => saveDraft("student")}
                        >
                          💾 Uložit změny
                        </button>
                        <button
                          className="tcdBtn ghost"
                          type="button"
                          onClick={() => {
                            setStudentDraft(normalizeMd(studentView || ""));
                            setIsEditingStudent(false);
                          }}
                        >
                          Zrušit
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TEACHER NOTES */}
            {tab === "teacher" && (
              <div className="tcdCard">
                <div className="tcdCardHeader" style={{ alignItems: "baseline" }}>
                  <div className="tcdCardTitle">Osnova pro učitele</div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ opacity: 0.65, fontSize: 13 }}>
                      verze:{" "}
                      {activeTeacherVersionId
                        ? formatTime(getById(activeTeacherVersionId)?.createdAt)
                        : "—"}
                    </div>

                    {!isEditingTeacher ? (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingTeacher(true)}
                        disabled={noNotesYet}
                      >
                        ✏️ Upravit
                      </button>
                    ) : (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingTeacher(false)}
                      >
                        👁️ Náhled
                      </button>
                    )}
                  </div>
                </div>

                {noNotesYet ? (
                  <div style={{ ...paperBox, opacity: 0.9 }}>
                    Nejdřív vygenerujte obsah v záložce <b>Tvorba</b>!
                  </div>
                ) : (
                  <>
                    <select
                      className="tcdInput"
                      value={activeTeacherVersionId || ""}
                      onChange={(e) => setActiveTeacherVersionId(e.target.value || null)}
                      disabled={history.length === 0}
                      style={{ marginBottom: 12 }}
                    >
                      <option value="">
                        {history.length === 0 ? "— žádné verze —" : "Vyber verzi"}
                      </option>
                      {history.map((h, idx) => (
                        <option key={h.id} value={h.id}>
                          {`Verze ${history.length - idx} — ${h.label} — ${formatTime(
                            h.createdAt
                          )}${dbTeacherVersionId === h.id ? " ✅ (trvale uloženo)" : ""}`}
                        </option>
                      ))}
                    </select>

                    {!isEditingTeacher ? (
                      <div style={paperBox} className="mdBody">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {normalizeMd(teacherDraft) || "—"}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <textarea
                        className="tcdInput"
                        value={teacherDraft}
                        onChange={(e) => setTeacherDraft(e.target.value)}
                        style={codeTextareaStyle}
                      />
                    )}

                    {isEditingTeacher && (
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          marginTop: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className="tcdBtn"
                          type="button"
                          onClick={() => saveDraft("teacher")}
                        >
                          💾 Uložit změny
                        </button>
                        <button
                          className="tcdBtn ghost"
                          type="button"
                          onClick={() => {
                            setTeacherDraft(normalizeMd(teacherView || ""));
                            setIsEditingTeacher(false);
                          }}
                        >
                          Zrušit
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* QUIZ */}
            {tab === "quiz" && (
              <div className="tcdCard">
                <div className="tcdCardHeader" style={{ alignItems: "baseline" }}>
                  <div className="tcdCardTitle">Quiz</div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {!isEditingQuiz ? (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingQuiz(true)}
                        disabled={!activeQuizVersionId}
                      >
                        ✏️ Upravit Kvíz
                      </button>
                    ) : (
                      <button
                        className="tcdBtn ghost"
                        type="button"
                        onClick={() => setIsEditingQuiz(false)}
                      >
                        👁️ Náhled
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div className="tcdField" style={{ maxWidth: 120 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6, color: "#333" }}>MCQ</div>
                      <input
                        className="tcdInput"
                        type="number"
                        min={0}
                        max={50}
                        value={quizMcq}
                        onChange={(e) => setQuizMcq(Number(e.target.value || 0))}
                      />
                    </div>

                    <div className="tcdField" style={{ maxWidth: 120 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6, color: "#333" }}>ANO/NE</div>
                      <input
                        className="tcdInput"
                        type="number"
                        min={0}
                        max={50}
                        value={quizYesNo}
                        onChange={(e) => setQuizYesNo(Number(e.target.value || 0))}
                      />
                    </div>

                    <div className="tcdField" style={{ maxWidth: 160 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6, color: "#333" }}>FINAL_OPEN</div>
                      <select
                        className="tcdInput"
                        value={quizFinalOpen}
                        onChange={(e) => setQuizFinalOpen(Number(e.target.value))}
                      >
                        <option value={1}>1 (doporučeno)</option>
                        <option value={0}>0</option>
                      </select>
                    </div>
                  </div>

                  <button
                    className="tcdBtn primary ttFullWidth"
                    type="button"
                    onClick={onGenerateQuiz}
                    disabled={quizLoading}
                  >
                    {quizLoading ? "Generuji…" : "Spustit generování"}
                  </button>
                </div>

                <select
                  className="tcdInput"
                  value={activeQuizVersionId || ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setActiveQuizVersionId(id);
                    const it = getQuizById(id);
                    if (it?.quizSnapshot) setQuizDraftJson(safeJsonStringify(it.quizSnapshot));
                    setIsEditingQuiz(false);
                  }}
                  disabled={quizHistory.length === 0}
                  style={{ marginBottom: 12 }}
                >
                  <option value="">
                    {quizHistory.length === 0 ? "— žádné verze kvízu —" : "Vyber verzi kvízu"}
                  </option>
                  {quizHistory.map((h, idx) => (
                    <option key={h.id} value={h.id}>
                      {`Verze ${quizHistory.length - idx} — ${h.label} — ${formatTime(
                        h.createdAt
                      )}${dbQuizVersionId === h.id ? " ✅ (trvale uloženo) " : ""}`}
                    </option>
                  ))}
                </select>

                {activeQuizVersionId ? (
                  !isEditingQuiz ? (
                    <div style={paperBox}>
                      {(() => {
                        let parsed = null;
                        try {
                          parsed = safeParseJson(quizDraftJson);
                        } catch {
                          return <div style={{ opacity: 0.75 }}>Neplatný JSON — přepni na „Upravit (JSON)“ a oprav strukturu.</div>;
                        }
                        const qs = parsed?.questions || [];
                        if (!qs.length) return <div style={{ opacity: 0.75 }}>— žádné otázky —</div>;

                        return (
                          <div className="ttQuizPreview">
                            {qs.map((q, i) => {
                              const optKeys =
                                q.type === "mcq"
                                  ? ["A", "B", "C", "D"]
                                  : q.type === "yesno"
                                    ? ["A", "B"]
                                    : [];
                              return (
                                <article key={q.id || i} className="ttQuizQCard">
                                  <div className="ttQuizQHead">
                                    <span className="ttQuizQNum" aria-hidden="true">
                                      {i + 1}
                                    </span>
                                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                                      <div className="ttQuizQMeta">
                                        <span className="ttQuizBadge">{quizTypeLabelCs(q.type)}</span>
                                        <span className="ttQuizBadge ttQuizBadgeDiff">
                                          náročnost {q.difficulty ?? "—"}
                                        </span>
                                      </div>
                                      <p className="ttQuizPrompt">{q.prompt}</p>
                                    </div>
                                  </div>

                                  {q.type === "final_open" && (
                                    <div className="ttQuizOpenHint">
                                      Otevřená otázka — žák píše vlastní odpověď (v náhledu není jedna „správná“ varianta).
                                    </div>
                                  )}

                                  {(q.type === "mcq" || q.type === "yesno") && q.options && (
                                    <div className="ttQuizOpts">
                                      {optKeys.map((k) => {
                                        const text = q.options?.[k];
                                        if (text == null || text === "") return null;
                                        const correct = String(q.correct_answer || "").toUpperCase() === k;
                                        return (
                                          <div
                                            key={k}
                                            className={`ttQuizOpt${correct ? " ttQuizOptCorrect" : ""}`}
                                          >
                                            <span className="ttQuizOptKey">{k}</span>
                                            <span>{text}</span>
                                            {correct ? (
                                              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800 }}>
                                                správně
                                              </span>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {q.explanation ? (
                                    <div className="ttQuizExplain">
                                      <strong style={{ fontStyle: "normal" }}>Vysvětlení:</strong> {q.explanation}
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <textarea
                      className="tcdInput"
                      value={quizDraftJson}
                      onChange={(e) => setQuizDraftJson(e.target.value)}
                      style={codeTextareaStyle}
                    />
                  )
                ) : (
                  <div style={{ ...paperBox, opacity: 0.9 }}>
                    Zatím nemáš žádný kvíz. Klikni na <b>Spustit generování</b>.
                  </div>
                )}

              </div>
            )}

            {/* Metadata collapsible */}
            {(tab === "teacher" || tab === "student") && (
              <div className="tcdCard" style={{ opacity: 0.98 }}>
                <button
                  className="tcdBtn ghost"
                  type="button"
                  onClick={() => setShowMeta((v) => !v)}
                  style={{ width: "fit-content" }}
                >
                  {showMeta ? "▾ Skrýt metadata" : "▸ Zobrazit metadata"}
                </button>

                {showMeta && (
                  <pre
                    style={{
                      marginTop: 10,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      borderRadius: 16,
                      padding: 12,
                      whiteSpace: "pre-wrap",
                      marginBottom: 0,
                      color: "#1f2330",
                      fontSize: 12,
                      lineHeight: 1.4,
                      overflowX: "auto",
                    }}
                  >
                    {JSON.stringify(extractedView, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          <div className="ttTopicDetailSidebar">
            <TeacherTopicRightPanel
              tab={tab}
              onRun={onRun}
              loading={loading}
              fileInputRef={fileInputRef}
              onFilesChange={onFilesChange}
              files={files}
              removeFileAt={removeFileAt}
              clearFiles={clearFiles}
              isPdfFile={isPdfFile}
              isImageFile={isImageFile}
              dbTeacherLabel={dbTeacherLabel}
              dbStudentLabel={dbStudentLabel}
              dbQuizLabel={dbQuizLabel}
              onSaveFinalQuiz={onSaveFinalQuiz}
              saveFinalFromActive={saveFinalFromActive}
              quizSaveLoading={quizSaveLoading}
              activeQuizVersionId={activeQuizVersionId}
              saveFinalLoading={saveFinalLoading}
              noNotesYet={noNotesYet}
              regenTarget={regenTarget}
              setRegenTarget={setRegenTarget}
              userNote={userNote}
              setUserNote={setUserNote}
              onRegenerateQuiz={handleRegenerateQuiz}
              onRegenerate={handleRegenerateNotes}
              quizRegenLoading={quizRegenLoading}
              regenLoading={regenLoading}
            />
          </div>
        </div>

        <Modal
          open={backConfirmOpen}
          onClose={() => setBackConfirmOpen(false)}
          title="Opustit kapitolu?"
        >
          <p className="tcdConfirmModalBody">
            Jste si jisti, že máte vybranou trvale uloženou správnou verzi? Všechny ostatní budou
            smazány.
          </p>
          <div className="gaModalActions">
            <button type="button" className="tcdBtn" onClick={() => setBackConfirmOpen(false)}>
              Zrušit
            </button>
            <button type="button" className="tcdBtn primary" onClick={confirmNavigateBackToClass}>
              Zpět na třídu
            </button>
          </div>
        </Modal>
      </div>
    </div>
  );
}
